package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

const currentPeriod = "2026-Q1"

var db *sql.DB

type regionCache struct {
	mu      sync.RWMutex
	data    []Region
	expires time.Time
}

var cache regionCache

type Region struct {
	ID             int      `json:"id"`
	Code           string   `json:"code"`
	Name           string   `json:"name"`
	FederalOkrug   string   `json:"federal_okrug"`
	Population     int      `json:"population"`
	GridX          int      `json:"grid_x"`
	GridY          int      `json:"grid_y"`
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
	Region     Region     `json:"region"`
	Indicators *Indicator `json:"indicators"`
	Forecasts  []Forecast `json:"forecasts"`
	Devices    []Device   `json:"devices"`
}

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

func listRegions(w http.ResponseWriter, r *http.Request) {
	cache.mu.RLock()
	if time.Now().Before(cache.expires) {
		data := cache.data
		cache.mu.RUnlock()
		writeJSON(w, 200, data)
		return
	}
	cache.mu.RUnlock()

	rows, err := db.QueryContext(r.Context(), `
		SELECT rg.id, rg.code, rg.name, rg.federal_okrug, rg.population,
		       rg.grid_x, rg.grid_y, hi.life_expectancy, hi.doctors_per_10k
		FROM regions rg
		LEFT JOIN health_indicators hi
		       ON hi.region_id = rg.id AND hi.period = $1
		ORDER BY rg.name`, currentPeriod)
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

	cache.mu.Lock()
	cache.data = out
	cache.expires = time.Now().Add(30 * time.Second)
	cache.mu.Unlock()

	writeJSON(w, 200, out)
}

func regionDetail(w http.ResponseWriter, id int, r *http.Request) {
	ctx := r.Context()
	var d RegionDetail

	err := db.QueryRowContext(ctx, `
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

	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		firstErr error
	)

	setErr := func(e error) {
		mu.Lock()
		if firstErr == nil {
			firstErr = e
		}
		mu.Unlock()
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		var ind Indicator
		err := db.QueryRowContext(ctx, `
			SELECT period, hospitals, doctors_per_10k, beds_per_10k, life_expectancy, incidence_rate
			FROM health_indicators WHERE region_id = $1 AND period = $2`, id, currentPeriod).
			Scan(&ind.Period, &ind.Hospitals, &ind.DoctorsPer10k, &ind.BedsPer10k,
				&ind.LifeExpectancy, &ind.IncidenceRate)
		if err == nil {
			mu.Lock()
			d.Indicators = &ind
			mu.Unlock()
		} else if err != sql.ErrNoRows {
			setErr(err)
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		fr, err := db.QueryContext(ctx, `
			SELECT id, horizon_year, metric, value, unit, COALESCE(note,'')
			FROM forecasts WHERE region_id = $1 ORDER BY horizon_year, metric`, id)
		if err != nil {
			setErr(err)
			return
		}
		defer fr.Close()
		forecasts := []Forecast{}
		for fr.Next() {
			var f Forecast
			if err := fr.Scan(&f.ID, &f.HorizonYear, &f.Metric, &f.Value, &f.Unit, &f.Note); err != nil {
				setErr(err)
				return
			}
			forecasts = append(forecasts, f)
		}
		mu.Lock()
		d.Forecasts = forecasts
		mu.Unlock()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		dv, err := db.QueryContext(ctx, `
			SELECT id, name, COALESCE(category,''), quantity, status
			FROM devices WHERE region_id = $1 ORDER BY id`, id)
		if err != nil {
			setErr(err)
			return
		}
		defer dv.Close()
		devices := []Device{}
		for dv.Next() {
			var dev Device
			if err := dv.Scan(&dev.ID, &dev.Name, &dev.Category, &dev.Quantity, &dev.Status); err != nil {
				setErr(err)
				return
			}
			devices = append(devices, dev)
		}
		mu.Lock()
		d.Devices = devices
		mu.Unlock()
	}()

	wg.Wait()

	if firstErr != nil {
		writeJSON(w, 500, map[string]string{"error": firstErr.Error()})
		return
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
	res, err := db.ExecContext(r.Context(), `
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
	err := db.QueryRowContext(r.Context(), `
		INSERT INTO devices (region_id, name, category, quantity, status)
		VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		regionID, body.Name, body.Category, body.Quantity, body.Status).Scan(&body.ID)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 201, body)
}

func apiRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	switch {
	case len(parts) == 1 && parts[0] == "regions" && r.Method == http.MethodGet:
		listRegions(w, r)

	case len(parts) == 2 && parts[0] == "regions" && r.Method == http.MethodGet:
		if id, err := strconv.Atoi(parts[1]); err == nil {
			regionDetail(w, id, r)
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
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err = db.Ping(); err != nil {
		log.Fatalf("нет соединения с PostgreSQL: %v", err)
	}
	log.Println("Соединение с PostgreSQL установлено")

	mux := http.NewServeMux()
	mux.HandleFunc("/api/", cors(apiRouter))
	mux.Handle("/", http.FileServer(http.Dir("../frontend")))

	srv := &http.Server{Addr: ":8080", Handler: mux}

	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("Завершение работы...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("Ошибка при завершении: %v", err)
		}
	}()

	log.Printf("ЗдравМонитор запущен на http://localhost:8080")
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Ошибка сервера: %v", err)
	}
}
