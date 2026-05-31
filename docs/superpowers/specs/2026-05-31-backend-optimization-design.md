# Backend Optimization Design — ЗдравМонитор

**Date:** 2026-05-31  
**Scope:** `backend/main.go` — performance and correctness improvements only. All existing endpoints, models, and business logic remain unchanged.

---

## Goal

Improve loading speed and reliability of the Go backend without changing any teacher-defined logic, endpoints, or data structures.

---

## Changes

### 1. Package-level constant for period

```go
const currentPeriod = "2026-Q1"
```

Replaces two hardcoded `'2026-Q1'` string literals (in `listRegions` and `regionDetail`). No behaviour change.

### 2. DB connection pool tuning

Immediately after `sql.Open`:

```go
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(10)
db.SetConnMaxLifetime(5 * time.Minute)
```

Prevents unbounded connection growth under concurrent load. Values are safe defaults for a single-node Postgres instance.

### 3. Context propagation

All DB calls switch to their `Context` variants using `r.Context()`:
- `db.QueryContext` / `db.QueryRowContext` / `db.ExecContext`

When a client disconnects mid-request, the in-flight DB query is cancelled immediately instead of holding the connection open.

### 4. Parallel queries in `regionDetail`

Current: 4 sequential queries (region → indicators → forecasts → devices).  
After: region fetch first (needed for 404 check), then indicators/forecasts/devices fan out in 3 concurrent goroutines via `sync.WaitGroup`. Errors from all goroutines are collected; any error returns a 500.

Wall-clock latency: sum-of-4 → max-of-3 (roughly 3× faster on the detail endpoint).

### 5. TTL cache for `GET /api/regions`

A struct protected by `sync.RWMutex`:

```go
type regionCache struct {
    mu      sync.RWMutex
    data    []Region
    expires time.Time
}
```

- TTL: 30 seconds
- Cache miss: fetch from DB, store result, set expiry
- Cache hit: return stored slice directly (microseconds)
- No new dependencies — stdlib only

### 6. Fix silent error swallowing in `regionDetail`

Forecasts and devices queries currently use `if err == nil { ... }` — failures silently return empty slices. After: errors are captured in the goroutine error collection and surface as HTTP 500.

### 7. Graceful shutdown

Replace `http.ListenAndServe` with:

```go
srv := &http.Server{Addr: addr, Handler: mux}
// goroutine: listen for SIGINT/SIGTERM
// on signal: srv.Shutdown(ctx) with 10s timeout
```

In-flight requests finish normally; process exits cleanly.

---

## What does NOT change

- All endpoints (`/api/regions`, `/api/regions/{id}`, `/api/forecasts/{id}`, `/api/regions/{id}/devices`)
- All model structs (`Region`, `Indicator`, `Forecast`, `Device`, `RegionDetail`)
- All SQL queries (only wrapped in `Context` variants)
- CORS middleware
- Static file serving (`../frontend`)
- `writeJSON` helper
- `apiRouter` dispatch logic
- All error messages and HTTP status codes

---

## Files touched

- `backend/main.go` — only file modified

---

## Dependencies

No new dependencies. Uses only: `database/sql`, `encoding/json`, `log`, `net/http`, `os`, `strconv`, `strings`, `sync`, `context`, `time`, `os/signal`, `syscall`.
