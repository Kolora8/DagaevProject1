# Morbidity DB Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 83-region morbidity dataset from static `morbidity.json` (444 KB) into PostgreSQL and serve it via a new `GET /api/dataset` Go endpoint.

**Architecture:** Six new tables in the existing `zdravmonitor` DB hold the dataset. A Python seed script populates them once from the JSON. The Go backend adds a `getDataset` handler that fans out 5 parallel queries and assembles the exact same JSON shape the frontend already expects. One line changes in `dataset.ts`.

**Tech Stack:** PostgreSQL, Go (`database/sql`, `sync`), Python 3 (`psycopg2`), Next.js (no new packages).

---

## File Map

| File | Action | What it does |
|---|---|---|
| `db/schema.sql` | Modify — append | 6 new table definitions |
| `db/seed_morbidity.py` | Create | Reads JSON → inserts all rows, idempotent |
| `backend/main.go` | Modify | New types, `dsCache`, `getDataset`, apiRouter entry |
| `frontend-next/lib/dataset.ts` | Modify — 1 line | `/morbidity.json` → `/api/dataset` |

---

## Task 1: DB Schema — 6 new tables

**Files:**
- Modify: `db/schema.sql`

- [ ] **Step 1: Append the new table definitions to `db/schema.sql`**

Add at the very end of the file:

```sql
CREATE TABLE IF NOT EXISTS morbidity_regions (
    code VARCHAR(8)   NOT NULL PRIMARY KEY,
    name VARCHAR(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS morbidity_diseases (
    key       VARCHAR(64)  NOT NULL PRIMARY KEY,
    label     VARCHAR(128) NOT NULL,
    order_idx INTEGER      NOT NULL
);

CREATE TABLE IF NOT EXISTS morbidity (
    region_code      VARCHAR(8)    NOT NULL REFERENCES morbidity_regions(code),
    year             VARCHAR(4)    NOT NULL,
    disease_key      VARCHAR(64)   NOT NULL REFERENCES morbidity_diseases(key),
    absolute_numbers NUMERIC(12,1) NOT NULL,
    per_100000       NUMERIC(10,1) NOT NULL,
    PRIMARY KEY (region_code, year, disease_key)
);

CREATE TABLE IF NOT EXISTS water_quality_data (
    region_code         VARCHAR(8)   NOT NULL REFERENCES morbidity_regions(code),
    year                VARCHAR(4)   NOT NULL,
    safe_water_pct      NUMERIC(6,1) NOT NULL,
    chem_violation_pct  NUMERIC(6,1) NOT NULL,
    micro_violation_pct NUMERIC(6,1) NOT NULL,
    pipe_violation_pct  NUMERIC(6,1) NOT NULL,
    PRIMARY KEY (region_code, year)
);

CREATE TABLE IF NOT EXISTS emissions_data (
    region_code   VARCHAR(8)    NOT NULL REFERENCES morbidity_regions(code),
    year          VARCHAR(4)    NOT NULL,
    total_kt      NUMERIC(12,2) NOT NULL,
    per_capita_kg NUMERIC(8,1)  NOT NULL,
    stationary_kt NUMERIC(12,2) NOT NULL,
    mobile_kt     NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (region_code, year)
);

CREATE TABLE IF NOT EXISTS births_data (
    region_code VARCHAR(8) NOT NULL REFERENCES morbidity_regions(code),
    year        VARCHAR(4) NOT NULL,
    count       INTEGER    NOT NULL,
    PRIMARY KEY (region_code, year)
);

CREATE INDEX IF NOT EXISTS idx_morbidity_region  ON morbidity(region_code);
CREATE INDEX IF NOT EXISTS idx_water_region      ON water_quality_data(region_code);
CREATE INDEX IF NOT EXISTS idx_emissions_region  ON emissions_data(region_code);
CREATE INDEX IF NOT EXISTS idx_births_region     ON births_data(region_code);
```

Note: `morbidity_regions` stores all 83 regions **plus** `code='RF'` (Russian Federation aggregate). RF morbidity rows go into the `morbidity` table with `region_code='RF'`. RF emissions is NOT stored — it has a different schema and is unused by the frontend.

- [ ] **Step 2: Apply the new tables to the running DB**

```bash
psql "$DATABASE_URL" -c "
CREATE TABLE IF NOT EXISTS morbidity_regions (
    code VARCHAR(8)   NOT NULL PRIMARY KEY,
    name VARCHAR(128) NOT NULL
);
CREATE TABLE IF NOT EXISTS morbidity_diseases (
    key       VARCHAR(64)  NOT NULL PRIMARY KEY,
    label     VARCHAR(128) NOT NULL,
    order_idx INTEGER      NOT NULL
);
CREATE TABLE IF NOT EXISTS morbidity (
    region_code      VARCHAR(8)    NOT NULL REFERENCES morbidity_regions(code),
    year             VARCHAR(4)    NOT NULL,
    disease_key      VARCHAR(64)   NOT NULL REFERENCES morbidity_diseases(key),
    absolute_numbers NUMERIC(12,1) NOT NULL,
    per_100000       NUMERIC(10,1) NOT NULL,
    PRIMARY KEY (region_code, year, disease_key)
);
CREATE TABLE IF NOT EXISTS water_quality_data (
    region_code         VARCHAR(8)   NOT NULL REFERENCES morbidity_regions(code),
    year                VARCHAR(4)   NOT NULL,
    safe_water_pct      NUMERIC(6,1) NOT NULL,
    chem_violation_pct  NUMERIC(6,1) NOT NULL,
    micro_violation_pct NUMERIC(6,1) NOT NULL,
    pipe_violation_pct  NUMERIC(6,1) NOT NULL,
    PRIMARY KEY (region_code, year)
);
CREATE TABLE IF NOT EXISTS emissions_data (
    region_code   VARCHAR(8)    NOT NULL REFERENCES morbidity_regions(code),
    year          VARCHAR(4)    NOT NULL,
    total_kt      NUMERIC(12,2) NOT NULL,
    per_capita_kg NUMERIC(8,1)  NOT NULL,
    stationary_kt NUMERIC(12,2) NOT NULL,
    mobile_kt     NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (region_code, year)
);
CREATE TABLE IF NOT EXISTS births_data (
    region_code VARCHAR(8) NOT NULL REFERENCES morbidity_regions(code),
    year        VARCHAR(4) NOT NULL,
    count       INTEGER    NOT NULL,
    PRIMARY KEY (region_code, year)
);
CREATE INDEX IF NOT EXISTS idx_morbidity_region  ON morbidity(region_code);
CREATE INDEX IF NOT EXISTS idx_water_region      ON water_quality_data(region_code);
CREATE INDEX IF NOT EXISTS idx_emissions_region  ON emissions_data(region_code);
CREATE INDEX IF NOT EXISTS idx_births_region     ON births_data(region_code);
"
```

Expected: `CREATE TABLE` × 6, `CREATE INDEX` × 4 (no errors).

- [ ] **Step 3: Verify tables exist**

```bash
psql "$DATABASE_URL" -c "\dt morbidity* water_quality_data emissions_data births_data"
```

Expected: 6 tables listed.

- [ ] **Step 4: Commit**

```bash
git add db/schema.sql
git commit -m "feat: add morbidity dataset tables to schema"
```

---

## Task 2: Seed Script

**Files:**
- Create: `db/seed_morbidity.py`

- [ ] **Step 1: Create the seed script**

Create `db/seed_morbidity.py` with this content:

```python
import json
import os
import sys
import psycopg2

DSN = os.environ.get(
    "DATABASE_URL",
    "postgres://postgres:postgres@localhost:5432/zdravmonitor?sslmode=disable"
)
JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend-next", "public", "morbidity.json")

def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    conn = psycopg2.connect(DSN)
    cur = conn.cursor()

    # diseases
    for idx, d in enumerate(data["meta"]["diseases"]):
        cur.execute(
            "INSERT INTO morbidity_diseases (key, label, order_idx) VALUES (%s, %s, %s) ON CONFLICT (key) DO NOTHING",
            (d["key"], d["label"], idx),
        )

    # RF region row
    cur.execute(
        "INSERT INTO morbidity_regions (code, name) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING",
        ("RF", "Российская Федерация"),
    )

    # RF morbidity
    for year, diseases in data["rf"]["morbidity"].items():
        for dkey, val in diseases.items():
            cur.execute(
                """INSERT INTO morbidity (region_code, year, disease_key, absolute_numbers, per_100000)
                   VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                ("RF", year, dkey, val["absolute_numbers"], val["per_100000"]),
            )

    # regions
    for r in data["regions"]:
        code = r["code"]

        cur.execute(
            "INSERT INTO morbidity_regions (code, name) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING",
            (code, r["name"]),
        )

        # morbidity
        for year, diseases in r.get("morbidity", {}).items():
            for dkey, val in diseases.items():
                cur.execute(
                    """INSERT INTO morbidity (region_code, year, disease_key, absolute_numbers, per_100000)
                       VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                    (code, year, dkey, val["absolute_numbers"], val["per_100000"]),
                )

        # water quality
        for year, val in r.get("water_quality", {}).items():
            cur.execute(
                """INSERT INTO water_quality_data
                       (region_code, year, safe_water_pct, chem_violation_pct, micro_violation_pct, pipe_violation_pct)
                   VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                (code, year, val["safe_water_pct"], val["chem_violation_pct"],
                 val["micro_violation_pct"], val["pipe_violation_pct"]),
            )

        # emissions (region-level only — RF emissions has different schema, skip)
        for year, val in r.get("emissions", {}).items():
            cur.execute(
                """INSERT INTO emissions_data
                       (region_code, year, total_kt, per_capita_kg, stationary_kt, mobile_kt)
                   VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                (code, year, val["total_kt"], val["per_capita_kg"],
                 val["stationary_kt"], val["mobile_kt"]),
            )

        # births
        for year, count in r.get("births", {}).items():
            cur.execute(
                "INSERT INTO births_data (region_code, year, count) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                (code, year, count),
            )

    conn.commit()
    cur.close()
    conn.close()
    print("Seed complete.")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Install psycopg2 if needed**

```bash
pip3 install psycopg2-binary
```

Expected: installs silently or `Requirement already satisfied`.

- [ ] **Step 3: Run the seed script**

```bash
cd /Users/kirill/Documents/Claude/Projects/DagaevCite/site
python3 db/seed_morbidity.py
```

Expected output: `Seed complete.`

- [ ] **Step 4: Verify row counts**

```bash
psql "$DATABASE_URL" -c "
SELECT 'morbidity_regions' AS tbl, COUNT(*) FROM morbidity_regions
UNION ALL SELECT 'morbidity_diseases', COUNT(*) FROM morbidity_diseases
UNION ALL SELECT 'morbidity',          COUNT(*) FROM morbidity
UNION ALL SELECT 'water_quality_data', COUNT(*) FROM water_quality_data
UNION ALL SELECT 'emissions_data',     COUNT(*) FROM emissions_data
UNION ALL SELECT 'births_data',        COUNT(*) FROM births_data;
"
```

Expected counts:
- `morbidity_regions`: 84 (83 regions + RF)
- `morbidity_diseases`: 5
- `morbidity`: 3,780 (84 × 9 years × 5 diseases)
- `water_quality_data`: 747 (83 regions × 9 years)
- `emissions_data`: 747
- `births_data`: 747

- [ ] **Step 5: Commit**

```bash
git add db/seed_morbidity.py
git commit -m "feat: add morbidity seed script"
```

---

## Task 3: Go Backend — types, cache, handler, route

**Files:**
- Modify: `backend/main.go`

### Step 1 — Add new types after the existing `RegionDetail` struct

- [ ] **Step 1: Add dataset types**

In `backend/main.go`, after the closing brace of `RegionDetail`, add:

```go
type MorbidityVal struct {
	AbsoluteNumbers float64 `json:"absolute_numbers"`
	Per100000       float64 `json:"per_100000"`
}

type WaterVal struct {
	SafeWaterPct      float64 `json:"safe_water_pct"`
	ChemViolationPct  float64 `json:"chem_violation_pct"`
	MicroViolationPct float64 `json:"micro_violation_pct"`
	PipeViolationPct  float64 `json:"pipe_violation_pct"`
}

type EmissionsVal struct {
	TotalKt      float64 `json:"total_kt"`
	PerCapitaKg  float64 `json:"per_capita_kg"`
	StationaryKt float64 `json:"stationary_kt"`
	MobileKt     float64 `json:"mobile_kt"`
}

type RegionDataset struct {
	Code         string                              `json:"code"`
	Name         string                              `json:"name"`
	Morbidity    map[string]map[string]*MorbidityVal `json:"morbidity"`
	Births       map[string]int                      `json:"births"`
	WaterQuality map[string]*WaterVal                `json:"water_quality"`
	Emissions    map[string]*EmissionsVal             `json:"emissions"`
}

type RFSection struct {
	Morbidity map[string]map[string]*MorbidityVal `json:"morbidity"`
}

type DiseaseMeta struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

type DatasetMeta struct {
	Years    []string      `json:"years"`
	Diseases []DiseaseMeta `json:"diseases"`
}

type DatasetResponse struct {
	Meta    DatasetMeta     `json:"meta"`
	RF      RFSection       `json:"rf"`
	Regions []RegionDataset `json:"regions"`
}

type datasetCache struct {
	mu      sync.RWMutex
	data    *DatasetResponse
	expires time.Time
}

var dsCache datasetCache
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/kirill/Documents/Claude/Projects/DagaevCite/site/backend && go build ./...
```

Expected: no output, exit 0.

### Step 2 — Add the getDataset handler

- [ ] **Step 3: Add `getDataset` function**

In `backend/main.go`, add this function before `apiRouter`:

```go
func getDataset(w http.ResponseWriter, r *http.Request) {
	dsCache.mu.RLock()
	if time.Now().Before(dsCache.expires) {
		data := dsCache.data
		dsCache.mu.RUnlock()
		writeJSON(w, 200, data)
		return
	}
	dsCache.mu.RUnlock()

	ctx := r.Context()

	drows, err := db.QueryContext(ctx,
		`SELECT key, label FROM morbidity_diseases ORDER BY order_idx`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	var diseases []DiseaseMeta
	for drows.Next() {
		var d DiseaseMeta
		if err := drows.Scan(&d.Key, &d.Label); err != nil {
			drows.Close()
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		diseases = append(diseases, d)
	}
	drows.Close()

	yrows, err := db.QueryContext(ctx,
		`SELECT DISTINCT year FROM morbidity ORDER BY year`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	var years []string
	for yrows.Next() {
		var y string
		if err := yrows.Scan(&y); err != nil {
			yrows.Close()
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		years = append(years, y)
	}
	yrows.Close()

	type regionInfo struct {
		code string
		name string
	}

	var (
		wg         sync.WaitGroup
		mu         sync.Mutex
		firstErr   error
		regionList []regionInfo
		morb       = map[string]map[string]map[string]*MorbidityVal{}
		waterMap   = map[string]map[string]*WaterVal{}
		emissMap   = map[string]map[string]*EmissionsVal{}
		birthsMap  = map[string]map[string]int{}
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
		rows, err := db.QueryContext(ctx,
			`SELECT code, name FROM morbidity_regions ORDER BY code`)
		if err != nil {
			setErr(err)
			return
		}
		defer rows.Close()
		var list []regionInfo
		for rows.Next() {
			var ri regionInfo
			if err := rows.Scan(&ri.code, &ri.name); err != nil {
				setErr(err)
				return
			}
			list = append(list, ri)
		}
		mu.Lock()
		regionList = list
		mu.Unlock()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, err := db.QueryContext(ctx,
			`SELECT region_code, year, disease_key, absolute_numbers, per_100000
			 FROM morbidity ORDER BY region_code, year, disease_key`)
		if err != nil {
			setErr(err)
			return
		}
		defer rows.Close()
		m := map[string]map[string]map[string]*MorbidityVal{}
		for rows.Next() {
			var code, year, dkey string
			var v MorbidityVal
			if err := rows.Scan(&code, &year, &dkey, &v.AbsoluteNumbers, &v.Per100000); err != nil {
				setErr(err)
				return
			}
			if m[code] == nil {
				m[code] = map[string]map[string]*MorbidityVal{}
			}
			if m[code][year] == nil {
				m[code][year] = map[string]*MorbidityVal{}
			}
			val := v
			m[code][year][dkey] = &val
		}
		mu.Lock()
		morb = m
		mu.Unlock()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, err := db.QueryContext(ctx,
			`SELECT region_code, year, safe_water_pct, chem_violation_pct, micro_violation_pct, pipe_violation_pct
			 FROM water_quality_data ORDER BY region_code, year`)
		if err != nil {
			setErr(err)
			return
		}
		defer rows.Close()
		m := map[string]map[string]*WaterVal{}
		for rows.Next() {
			var code, year string
			var v WaterVal
			if err := rows.Scan(&code, &year, &v.SafeWaterPct, &v.ChemViolationPct, &v.MicroViolationPct, &v.PipeViolationPct); err != nil {
				setErr(err)
				return
			}
			if m[code] == nil {
				m[code] = map[string]*WaterVal{}
			}
			val := v
			m[code][year] = &val
		}
		mu.Lock()
		waterMap = m
		mu.Unlock()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, err := db.QueryContext(ctx,
			`SELECT region_code, year, total_kt, per_capita_kg, stationary_kt, mobile_kt
			 FROM emissions_data ORDER BY region_code, year`)
		if err != nil {
			setErr(err)
			return
		}
		defer rows.Close()
		m := map[string]map[string]*EmissionsVal{}
		for rows.Next() {
			var code, year string
			var v EmissionsVal
			if err := rows.Scan(&code, &year, &v.TotalKt, &v.PerCapitaKg, &v.StationaryKt, &v.MobileKt); err != nil {
				setErr(err)
				return
			}
			if m[code] == nil {
				m[code] = map[string]*EmissionsVal{}
			}
			val := v
			m[code][year] = &val
		}
		mu.Lock()
		emissMap = m
		mu.Unlock()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, err := db.QueryContext(ctx,
			`SELECT region_code, year, count FROM births_data ORDER BY region_code, year`)
		if err != nil {
			setErr(err)
			return
		}
		defer rows.Close()
		m := map[string]map[string]int{}
		for rows.Next() {
			var code, year string
			var count int
			if err := rows.Scan(&code, &year, &count); err != nil {
				setErr(err)
				return
			}
			if m[code] == nil {
				m[code] = map[string]int{}
			}
			m[code][year] = count
		}
		mu.Lock()
		birthsMap = m
		mu.Unlock()
	}()

	wg.Wait()

	if firstErr != nil {
		writeJSON(w, 500, map[string]string{"error": firstErr.Error()})
		return
	}

	rfMorb := morb["RF"]
	if rfMorb == nil {
		rfMorb = map[string]map[string]*MorbidityVal{}
	}

	var regions []RegionDataset
	for _, ri := range regionList {
		if ri.code == "RF" {
			continue
		}
		rd := RegionDataset{
			Code:         ri.code,
			Name:         ri.name,
			Morbidity:    morb[ri.code],
			Births:       birthsMap[ri.code],
			WaterQuality: waterMap[ri.code],
			Emissions:    emissMap[ri.code],
		}
		if rd.Morbidity == nil {
			rd.Morbidity = map[string]map[string]*MorbidityVal{}
		}
		if rd.Births == nil {
			rd.Births = map[string]int{}
		}
		if rd.WaterQuality == nil {
			rd.WaterQuality = map[string]*WaterVal{}
		}
		if rd.Emissions == nil {
			rd.Emissions = map[string]*EmissionsVal{}
		}
		regions = append(regions, rd)
	}

	result := &DatasetResponse{
		Meta:    DatasetMeta{Years: years, Diseases: diseases},
		RF:      RFSection{Morbidity: rfMorb},
		Regions: regions,
	}

	dsCache.mu.Lock()
	dsCache.data = result
	dsCache.expires = time.Now().Add(5 * time.Minute)
	dsCache.mu.Unlock()

	writeJSON(w, 200, result)
}
```

- [ ] **Step 4: Add route to `apiRouter`**

In `apiRouter`, in the `switch` block, add before the `default` case:

```go
	case len(parts) == 1 && parts[0] == "dataset" && r.Method == http.MethodGet:
		getDataset(w, r)
```

- [ ] **Step 5: Build to verify no errors**

```bash
cd /Users/kirill/Documents/Claude/Projects/DagaevCite/site/backend && go build ./...
```

Expected: no output, exit 0.

- [ ] **Step 6: Smoke-test the endpoint**

Start the server (with `DATABASE_URL` set), then:

```bash
curl -s http://localhost:8080/api/dataset | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('years:', d['meta']['years'])
print('diseases:', [x['key'] for x in d['meta']['diseases']])
print('regions count:', len(d['regions']))
print('rf morbidity years:', sorted(d['rf']['morbidity'].keys()))
r0 = d['regions'][0]
print('first region code:', r0['code'], 'births keys:', sorted(r0['births'].keys()))
"
```

Expected output:
```
years: ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023']
diseases: ['cardiovascular', 'congenital_anomalies', 'hip_deformity', 'ichthyosis', 'nervous_system']
regions count: 83
rf morbidity years: ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023']
first region code: <any code>  births keys: ['2015', ..., '2023']
```

- [ ] **Step 7: Commit**

```bash
git add backend/main.go
git commit -m "feat: add GET /api/dataset endpoint serving morbidity data from PostgreSQL"
```

---

## Task 4: Frontend — switch from static JSON to API

**Files:**
- Modify: `frontend-next/lib/dataset.ts`

- [ ] **Step 1: Replace the fetch URL**

In `frontend-next/lib/dataset.ts`, change:

```diff
-  const res = await fetch("/morbidity.json", { cache: "no-store" });
-  if (!res.ok) throw new Error("morbidity.json не найден");
+  const res = await fetch("/api/dataset");
+  if (!res.ok) throw new Error("dataset API недоступен");
```

- [ ] **Step 2: Start dev server and verify the map loads**

```bash
cd /Users/kirill/Documents/Claude/Projects/DagaevCite/site/frontend-next
npm run dev
```

Open `http://localhost:3000` in browser. Verify:
- Map renders with all 83 regions coloured
- Year slider works (2015–2023)
- Clicking a region shows the data panel with morbidity table and trend chart
- RF comparison line appears in trend charts

- [ ] **Step 3: Verify no network requests to `morbidity.json`**

Open DevTools → Network tab → reload. Confirm:
- `GET /api/dataset` appears and returns 200
- No request to `/morbidity.json`

- [ ] **Step 4: Commit**

```bash
git add frontend-next/lib/dataset.ts
git commit -m "feat: load dataset from /api/dataset instead of static morbidity.json"
```

---

## Self-Review

**Spec coverage:**
- ✅ 6 new tables — Task 1
- ✅ Seed script from JSON — Task 2
- ✅ `GET /api/dataset` Go handler with parallel queries and 5-min cache — Task 3
- ✅ Frontend 1-line change — Task 4
- ✅ RF morbidity in DB — covered by seed script (region_code='RF')
- ✅ RF emissions skipped (different schema, unused by frontend) — documented in seed script

**No placeholders:** All steps have exact code, exact commands, expected output.

**Type consistency:**
- `MorbidityVal.AbsoluteNumbers` / `.Per100000` — used consistently in handler scan and struct definition
- `WaterVal`, `EmissionsVal`, `RegionDataset`, `RFSection`, `DatasetResponse` — defined in Task 3 Step 1, used in Step 3
- `dsCache` declared with `datasetCache` type — consistent throughout
- `DiseaseMeta.Key` / `.Label` — consistent with DB column names `key`, `label`
