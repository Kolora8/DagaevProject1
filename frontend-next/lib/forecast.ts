// Time-series forecasting methods used on the trend chart.
// All functions accept a clean array of numbers (no nulls) and return `periods` future values.

export const FORECAST_PERIODS = 3;
export const FORECAST_LABELS = ["2024", "2025", "2026"];

// ─── Simple Moving Average ─────────────────────────────────────────────────

export function smaForecast(data: number[], periods: number): number[] {
  const w = Math.min(3, data.length);
  const out: number[] = [];
  const buf = [...data];
  for (let i = 0; i < periods; i++) {
    const avg = buf.slice(-w).reduce((a, b) => a + b, 0) / w;
    out.push(Math.max(0, avg));
    buf.push(avg);
  }
  return out;
}

// ─── Holt's Linear Trend (double exponential smoothing) ───────────────────

function holtState(
  data: number[],
  alpha: number,
  beta: number
): { level: number; trend: number } {
  let L = data[0];
  let T = data.length > 1 ? data[1] - data[0] : 0;
  for (let i = 1; i < data.length; i++) {
    const prevL = L;
    L = alpha * data[i] + (1 - alpha) * (L + T);
    T = beta * (L - prevL) + (1 - beta) * T;
  }
  return { level: L, trend: T };
}

function holtSSE(data: number[], alpha: number, beta: number): number {
  let L = data[0];
  let T = data.length > 1 ? data[1] - data[0] : 0;
  let sse = 0;
  for (let i = 1; i < data.length; i++) {
    sse += (data[i] - (L + T)) ** 2;
    const prevL = L;
    L = alpha * data[i] + (1 - alpha) * (L + T);
    T = beta * (L - prevL) + (1 - beta) * T;
  }
  return sse;
}

export function holtForecast(data: number[], periods: number): number[] {
  if (data.length < 2) return Array(periods).fill(data[data.length - 1] ?? 0);

  // Grid search for best α and β (minimize one-step-ahead SSE)
  let bestSSE = Infinity;
  let bA = 0.3, bB = 0.1;
  for (let a = 0.1; a <= 0.9; a += 0.1) {
    for (let b = 0.05; b <= 0.5; b += 0.05) {
      const s = holtSSE(data, a, b);
      if (s < bestSSE) { bestSSE = s; bA = a; bB = b; }
    }
  }

  const { level, trend } = holtState(data, bA, bB);
  return Array.from({ length: periods }, (_, h) =>
    Math.max(0, level + (h + 1) * trend)
  );
}

// ─── ARIMA(1,1,1) via Conditional Least Squares ───────────────────────────
//
// Two-step AR-then-MA estimation is biased because:
//   1. ρ(1) ≠ θ for MA(1) — the correct relationship is ρ(1) = θ/(1+θ²)
//   2. AR residuals d_t − φ·d_{t-1} ignore the MA structure
//
// CLS jointly minimises Σ e_t² where innovations are computed recursively:
//   e_t = diff[t] − φ·diff[t−1] − θ·e[t−1]   (e[−1] = 0, diff[−1] = 0)
// This is the standard method used by R's arima() for short series.

export function arima111Forecast(data: number[], periods: number): number[] {
  if (data.length < 3) return smaForecast(data, periods);

  // Step 1: d=1 differencing
  const diff = data.slice(1).map((v, i) => v - data[i]);

  // Step 2: CLS objective — recursive innovations
  function css(phi: number, theta: number): number {
    let e = 0, sse = 0;
    for (let t = 0; t < diff.length; t++) {
      const d_prev = t > 0 ? diff[t - 1] : 0;
      e = diff[t] - phi * d_prev - theta * e;
      sse += e * e;
    }
    return sse;
  }

  // Coarse grid search over (φ, θ) ∈ [−0.9, 0.9]², step 0.1
  let bestSSE = Infinity, bPhi = 0, bTheta = 0;
  for (let p = -0.9; p <= 0.91; p += 0.1) {
    for (let q = -0.9; q <= 0.91; q += 0.1) {
      const s = css(p, q);
      if (s < bestSSE) { bestSSE = s; bPhi = p; bTheta = q; }
    }
  }

  // Fine search ±0.1 around best with step 0.02
  for (let p = bPhi - 0.1; p <= bPhi + 0.11; p += 0.02) {
    for (let q = bTheta - 0.1; q <= bTheta + 0.11; q += 0.02) {
      if (Math.abs(p) >= 1 || Math.abs(q) >= 1) continue;
      const s = css(p, q);
      if (s < bestSSE) { bestSSE = s; bPhi = p; bTheta = q; }
    }
  }

  // Step 3: Recompute last innovation with fitted (φ, θ)
  let lastE = 0;
  for (let t = 0; t < diff.length; t++) {
    const d_prev = t > 0 ? diff[t - 1] : 0;
    lastE = diff[t] - bPhi * d_prev - bTheta * lastE;
  }

  // Step 4: Multi-step forecast on the differenced series
  //   E[diff_{n+h}] = φ·E[diff_{n+h−1}] + θ·E[e_{n+h−1}]
  //   E[e_{n+h}] = 0 for h ≥ 1 (future innovations are white noise)
  //   Only h=1 uses the known last innovation lastE via the MA term
  const forecastDiffs: number[] = [];
  for (let h = 0; h < periods; h++) {
    const d_prev = h === 0 ? diff[diff.length - 1] : forecastDiffs[h - 1];
    const e_prev = h === 0 ? lastE : 0;
    forecastDiffs.push(bPhi * d_prev + bTheta * e_prev);
  }

  // Step 5: Cumulate back to levels
  let level = data[data.length - 1];
  return forecastDiffs.map(fd => {
    level += fd;
    return Math.max(0, level);
  });
}

// ─── Best method (hold-out evaluation) ────────────────────────────────────

export type ForecastKey = "holt" | "arima" | "sma";

const METHODS: Record<ForecastKey, (d: number[], p: number) => number[]> = {
  holt:  holtForecast,
  arima: arima111Forecast,
  sma:   smaForecast,
};

export const METHOD_LABELS: Record<ForecastKey, string> = {
  holt:  "Holt-Winters",
  arima: "ARIMA(1,1,1)",
  sma:   "SMA(3)",
};

function rmse(actual: number[], pred: number[]): number {
  const n = Math.min(actual.length, pred.length);
  if (n === 0) return Infinity;
  return Math.sqrt(
    actual.slice(0, n).reduce((s, a, i) => s + (a - pred[i]) ** 2, 0) / n
  );
}

export function bestMethod(data: number[]): ForecastKey {
  if (data.length < 4) return "sma";
  const holdN = Math.min(2, Math.floor(data.length / 3));
  const train = data.slice(0, data.length - holdN);
  const test  = data.slice(data.length - holdN);

  let best: ForecastKey = "sma";
  let bestErr = Infinity;
  type FnType = (d: number[], p: number) => number[];
  for (const [key, fn] of Object.entries(METHODS) as [ForecastKey, FnType][]) {
    try {
      const err = rmse(test, fn(train, holdN));
      if (err < bestErr) { bestErr = err; best = key; }
    } catch { /* skip */ }
  }
  return best;
}

export function computeForecast(
  data: number[],
  method: ForecastKey | "best"
): number[] {
  if (data.length < 2) return Array(FORECAST_PERIODS).fill(data[data.length - 1] ?? 0);
  const key = method === "best" ? bestMethod(data) : method;
  try {
    return METHODS[key](data, FORECAST_PERIODS);
  } catch {
    return smaForecast(data, FORECAST_PERIODS);
  }
}
