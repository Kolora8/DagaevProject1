# Morbidity Data — Migration to PostgreSQL

**Date:** 2026-06-01  
**Scope:** Move `morbidity.json` (444 KB, 83 regions) from static file to PostgreSQL. Serve via new `GET /api/dataset` endpoint. One-line frontend change.

---

## DB Schema — 6 new tables

```sql
morbidity_regions  (code VARCHAR(8) PK, name VARCHAR(128))
morbidity_diseases (key  VARCHAR(64) PK, label VARCHAR(128))

morbidity (
  region_code  VARCHAR(8)  REFERENCES morbidity_regions,
  year         VARCHAR(4),
  disease_key  VARCHAR(64) REFERENCES morbidity_diseases,
  absolute_numbers NUMERIC(12,1),
  per_100000       NUMERIC(10,1),
  UNIQUE(region_code, year, disease_key)
)

water_quality_data (
  region_code         VARCHAR(8) REFERENCES morbidity_regions,
  year                VARCHAR(4),
  safe_water_pct      NUMERIC(6,1),
  chem_violation_pct  NUMERIC(6,1),
  micro_violation_pct NUMERIC(6,1),
  pipe_violation_pct  NUMERIC(6,1),
  UNIQUE(region_code, year)
)

emissions_data (
  region_code   VARCHAR(8) REFERENCES morbidity_regions,
  year          VARCHAR(4),
  total_kt      NUMERIC(12,2),
  per_capita_kg NUMERIC(8,1),
  stationary_kt NUMERIC(12,2),
  mobile_kt     NUMERIC(12,2),
  UNIQUE(region_code, year)
)

births_data (
  region_code VARCHAR(8) REFERENCES morbidity_regions,
  year        VARCHAR(4),
  count       INTEGER,
  UNIQUE(region_code, year)
)
```

RF-level aggregates stored with `region_code = 'RF'`. Indexes on `(region_code, year)` for all child tables.

## Seed Script

`db/seed_morbidity.py` — Python script using `psycopg2`. Reads `frontend-next/public/morbidity.json`, inserts all data in a single transaction. Idempotent (`ON CONFLICT DO NOTHING`). Run once:

```
python3 db/seed_morbidity.py
```

Requires `DATABASE_URL` env var (same as Go backend).

## Go API — new endpoint

`GET /api/dataset` in `backend/main.go`:

- Builds `Dataset` struct matching the exact shape of `morbidity.json`
- 4 parallel DB queries (`sync.WaitGroup`): morbidity, water, emissions, births
- TTL cache: 5 minutes (data is read-only after seeding)
- Added to `apiRouter` switch: `parts[0] == "dataset" && r.Method == http.MethodGet`

Response shape (identical to current JSON):
```json
{
  "meta": { "years": [...], "diseases": [...] },
  "rf":   { "morbidity": {...}, "births": {...}, "water_quality": {...}, "emissions": {...} },
  "regions": [{ "code": "RUAD", "name": "...", "morbidity": {...}, ... }]
}
```

## Frontend Change

Single line in `frontend-next/lib/dataset.ts`:

```diff
- const res = await fetch("/morbidity.json", { cache: "no-store" });
+ const res = await fetch("/api/dataset");
```

## Files Changed

- `db/schema.sql` — append 6 new table definitions
- `db/seed_morbidity.py` — new seed script
- `backend/main.go` — new handler + dataset cache + apiRouter entry
- `frontend-next/lib/dataset.ts` — one line

## What Does NOT Change

- Existing tables (`regions`, `health_indicators`, `forecasts`, `devices`) untouched
- All existing API endpoints unchanged
- `morbidity.json` kept in place (not deleted), just no longer fetched by frontend
- All frontend components and logic unchanged
