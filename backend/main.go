// ============================================================
//  ЗдравМонитор — backend API (GoLang + PostgreSQL)
//
//  Эндпоинты:
//    GET    /api/regions                 — список регионов с текущими показателями
//    GET    /api/regions/{id}            — подробности региона (показатели, прогнозы, устройства)
//    PUT    /api/forecasts/{id}          — редактировать прогноз (value, note)
//    POST   /api/regions/{id}/devices    — добавить новое устройство
//
//  Запуск:
//    export DATABASE_URL="postgres://postgres:postgres@localhost:5432/zdravmonitor?sslmode=disable"
//    go run .
//
//  Сервер также раздаёт статический фронтенд из ../frontend
// ============================================================

package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	_ "github.com/lib/pq"
)

var db *sql.DB

// ---------- модели ----------

type Region struct {
	ID            int     `json:"id"`
	Code          string  `json:"code"`
	Name          string  `json:"name"`
	FederalOkrug  string  `json:"federal_okrug"`
	Population    int     `json:"population"`
	GridX         int     `json:"grid_x"`
	GridY         int     `json:"grid_y"`
	LifeExpectancy *float64 `json:"life_expectancy,omitempty"`
	DoctorsPer10k  *float64 `json:"doctors_per_10k,omitempty"`
}

type Indicator struct {
	Period         string  `json:"period"`
	Hospitals      int     `json:"hospitals"`
	DoctorsPer10k  float64 `json:"doctors_per_10k"`
	BedsPer10k     float64 `json:"beds_per_10k"`
	LifeExpectancy float64 `json:"life_expectancy"`
	IncidenceRate  float64 `json:"incidence_rate"`
}

type Forecast struct {
	ID          int     `json:"id"`
	HorizonYear int     `json:"horizon_year"`
	Metric      string  `json:"metric"`
	Value       float64 `json:"value"`
	Unit        string  `json:"unit"`
	Note        string  `json:"note"`
}

type Device struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
	Quantity int    `json:"quantity"`
	Status   string `json:"status"`
}

type RegionDetail struct {
	Region     Region      `json:"region"`
	Indicators *Indicator  `json:"indicators"`
	Forecasts  []Forecast  `json:"forecasts"`
	Devices    []Device    `json:"devices"`
}

// ---------- утилиты ----------

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// ---------- обработчики ----------

func listRegions(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT rg.id, rg.code, rg.name, rg.federal_okrug, rg.population,
		       rg.grid_x, rg.grid_y, hi.life_expectancy, hi.doctors_per_10k
		FROM regions rg
		LEFT JOIN health_indicators hi
		       ON hi.region_id = rg.id AND hi.period = '2026-Q1'
		ORDER BY rg.name`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	out := []Region{}
	for rows.Next() {
		var rg Region
		var le, dpt sql.NullFloat64
		if err := rows.Scan(&rg.ID, &rg.Code, &rg.Name, &rg.FederalOkrug,
			&rg.Population, &rg.GridX, &rg.GridY, &le, &dpt); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if le.Valid {
			rg.LifeExpectancy = &le.Float64
		}
		if dpt.Valid {
			rg.DoctorsPer10k = &dpt.Float64
		}
		out = append(out, rg)
	}
	writeJSON(w, 200, out)
}

func regionDetail(w http.ResponseWriter, id int) {
	var d RegionDetail
	err := db.QueryRow(`
		SELECT id, code, name, federal_okrug, population, grid_x, grid_y
		FROM regions WHERE id = $1`, id).
		Scan(&d.Region.ID, &d.Region.Code, &d.Region.Name, &d.Region.FederalOkrug,
			&d.Region.Population, &d.Region.GridX, &d.Region.GridY)
	if err == sql.ErrNoRows {
		writeJSON(w, 404, map[string]string{"error": "регион не найден"})
		return
	} else if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	var ind Indicator
	err = db.QueryRow(`
		SELECT period, hospitals, doctors_per_10k, beds_per_10k, life_expectancy, incidence_rate
		FROM health_indicators WHERE region_id = $1 AND period = '2026-Q1'`, id).
		Scan(&ind.Period, &ind.Hospitals, &ind.DoctorsPer10k, &ind.BedsPer10k,
			&ind.LifeExpectancy, &ind.IncidenceRate)
	if err == nil {
		d.Indicators = &ind
	}

	d.Forecasts = []Forecast{}
	fr, err := db.Query(`
		SELECT id, horizon_year, metric, value, unit, COALESCE(note,'')
		FROM forecasts WHERE region_id = $1 ORDER BY horizon_year, metric`, id)
	if err == nil {
		defer fr.Close()
		for fr.Next() {
			var f Forecast
			fr.Scan(&f.ID, &f.HorizonYear, &f.Metric, &f.Value, &f.Unit, &f.Note)
			d.Forecasts = append(d.Forecasts, f)
		}
	}

	d.Devices = []Device{}
	dv, err := db.Query(`
		SELECT id, name, COALESCE(category,''), quantity, status
		FROM devices WHERE region_id = $1 ORDER BY id`, id)
	if err == nil {
		defer dv.Close()
		for dv.Next() {
			var dev Device
			dv.Scan(&dev.ID, &dev.Name, &dev.Category, &dev.Quantity, &dev.Status)
			d.Devices = append(d.Devices, dev)
		}
	}

	writeJSON(w, 200, d)
}

func updateForecast(w http.ResponseWriter, id int, r *http.Request) {
	var body struct {
		Value *float64 `json:"value"`
		Note  *string  `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]string{"error": "неверный JSON"})
		return
	}
	res, err := db.Exec(`
		UPDATE forecasts
		SET value = COALESCE($1, value),
		    note  = COALESCE($2, note),
		    updated_at = now()
		WHERE id = $3`, body.Value, body.Note, id)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, 404, map[string]string{"error": "прогноз не найден"})
		return
	}
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func addDevice(w http.ResponseWriter, regionID int, r *http.Request) {
	var body Device
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]string{"error": "неверный JSON"})
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeJSON(w, 400, map[string]string{"error": "не указано наименование устройства"})
		return
	}
	if body.Quantity <= 0 {
		body.Quantity = 1
	}
	if body.Status == "" {
		body.Status = "в эксплуатации"
	}
	err := db.QueryRow(`
		INSERT INTO devices (region_id, name, category, quantity, status)
		VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		regionID, body.Name, body.Category, body.Quantity, body.Status).Scan(&body.ID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 201, body)
}

// маршрутизация под /api/
func apiRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	switch {
	case len(parts) == 1 && parts[0] == "regions" && r.Method == http.MethodGet:
		listRegions(w, r)

	case len(parts) == 2 && parts[0] == "regions" && r.Method == http.MethodGet:
		if id, err := strconv.Atoi(parts[1]); err == nil {
			regionDetail(w, id)
		} else {
			writeJSON(w, 400, map[string]string{"error": "неверный id"})
		}

	case len(parts) == 3 && parts[0] == "regions" && parts[2] == "devices" && r.Method == http.MethodPost:
		if id, err := strconv.Atoi(parts[1]); err == nil {
			addDevice(w, id, r)
		} else {
			writeJSON(w, 400, map[string]string{"error": "неверный id"})
		}

	case len(parts) == 2 && parts[0] == "forecasts" && r.Method == http.MethodPut:
		if id, err := strconv.Atoi(parts[1]); err == nil {
			updateForecast(w, id, r)
		} else {
			writeJSON(w, 400, map[string]string{"error": "неверный id"})
		}

	default:
		writeJSON(w, 404, map[string]string{"error": "маршрут не найден"})
	}
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/zdravmonitor?sslmode=disable"
	}

	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("не удалось открыть БД: %v", err)
	}
	if err = db.Ping(); err != nil {
		log.Fatalf("нет соединения с PostgreSQL: %v", err)
	}
	log.Println("Соединение с PostgreSQL установлено")

	mux := http.NewServeMux()
	mux.HandleFunc("/api/", cors(apiRouter))

	// раздача фронтенда
	mux.Handle("/", http.FileServer(http.Dir("../frontend")))

	addr := ":8080"
	log.Printf("ЗдравМонитор запущен на http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
