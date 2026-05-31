"use client";

import { useState, useMemo } from "react";
import { Dataset, RegionData } from "@/lib/dataset";
import {
  computeForecast,
  FORECAST_LABELS,
  FORECAST_PERIODS,
  METHOD_LABELS,
  bestMethod,
  type ForecastKey,
} from "@/lib/forecast";
import LineChart, { Series } from "./LineChart";

type ForecastMode = "none" | "best" | ForecastKey;

const FORECAST_BUTTONS: { key: ForecastMode; label: string }[] = [
  { key: "none",  label: "Без прогноза" },
  { key: "best",  label: "★ Лучший" },
  { key: "holt",  label: "Holt-Winters" },
  { key: "arima", label: "ARIMA(1,1,1)" },
  { key: "sma",   label: "SMA(3)" },
];

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("ru-RU");

function trendPct(
  curr: number | null | undefined,
  prev: number | null | undefined
): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function TrendBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct == null || Math.abs(pct) < 0.1) return null;
  const up = pct > 0;
  const isBad = invert ? !up : up;
  return (
    <span className={`trend ${isBad ? "up" : "down"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function RegionDataPanel({
  region,
  data,
  disease,
  year,
}: {
  region: RegionData;
  data: Dataset;
  disease: string;
  year: string;
}) {
  const [forecastMode, setForecastMode] = useState<ForecastMode>("none");

  const { years, diseases } = data.meta;
  const diseaseLabel = diseases.find((d) => d.key === disease)?.label || disease;

  const yearIdx = years.indexOf(year);
  const prevYear = yearIdx > 0 ? years[yearIdx - 1] : null;

  const mYear = region.morbidity[year] || {};
  const mPrev = prevYear ? region.morbidity[prevYear] || {} : null;
  const water = region.water_quality[year];
  const waterPrev = prevYear ? region.water_quality[prevYear] : null;
  const births = region.births[year];
  const birthsPrev = prevYear ? region.births[prevYear] : null;
  const em = region.emissions[year];
  const emPrev = prevYear ? region.emissions[prevYear] : null;

  // Historical data points
  const regionPoints = years.map(
    (y) => region.morbidity[y]?.[disease]?.per_100000 ?? null
  );
  const rfPoints = years.map(
    (y) => data.rf.morbidity[y]?.[disease]?.per_100000 ?? null
  );

  // Forecast computation
  const forecastData = useMemo(() => {
    if (forecastMode === "none") return null;
    const clean = regionPoints.filter((v): v is number => v != null);
    if (clean.length < 2) return null;
    const method = forecastMode === "best" ? forecastMode : forecastMode;
    const values = computeForecast(clean, method);
    const resolvedKey = forecastMode === "best" ? bestMethod(clean) : forecastMode;
    const label = forecastMode === "best"
      ? `Прогноз (${METHOD_LABELS[resolvedKey]})`
      : `Прогноз ${METHOD_LABELS[forecastMode as ForecastKey]}`;
    return { values, label };
  }, [forecastMode, regionPoints]);

  // Build extended labels and series
  const extLabels = forecastMode !== "none" ? [...years, ...FORECAST_LABELS] : years;
  const histLen = years.length;
  const extLen = extLabels.length;

  const regionExt: (number | null)[] = forecastMode !== "none"
    ? [...regionPoints, ...Array(FORECAST_PERIODS).fill(null)]
    : regionPoints;

  const rfExt: (number | null)[] = forecastMode !== "none"
    ? [...rfPoints, ...Array(FORECAST_PERIODS).fill(null)]
    : rfPoints;

  const series: Series[] = [
    { label: region.name, color: "#38bdf8", points: regionExt },
    { label: "РФ (в среднем)", color: "#f59e0b", points: rfExt },
  ];

  if (forecastData) {
    // Connect forecast to last historical point
    const lastHistIdx = regionPoints.reduceRight((found, v, i) =>
      found === -1 && v != null ? i : found, -1);
    const lastHistVal = lastHistIdx >= 0 ? regionPoints[lastHistIdx] : null;

    const forecastPts: (number | null)[] = Array(extLen).fill(null);
    if (lastHistVal != null) forecastPts[lastHistIdx] = lastHistVal;
    forecastData.values.forEach((v, i) => {
      forecastPts[histLen + i] = v;
    });

    series.push({
      label: forecastData.label,
      color: "#a78bfa",
      points: forecastPts,
      dashed: true,
    });
  }

  return (
    <div>
      <h2 className="region-name">{region.name}</h2>
      <div className="region-meta">
        <span className="region-code">{region.code}</span>
      </div>

      {/* ── Morbidity table ── */}
      <div className="card">
        <div className="card-header">
          <h3>Заболеваемость · на 100 тыс.</h3>
          <span className="legend-cap">{year}</span>
        </div>
        <table className="dtable">
          <tbody>
            {diseases.map((d) => {
              const v = mYear[d.key];
              const vPrev = mPrev?.[d.key];
              const pct = trendPct(v?.per_100000, vPrev?.per_100000);
              return (
                <tr key={d.key} className={d.key === disease ? "row-on" : undefined}>
                  <td>{d.label}</td>
                  <td className="num">{fmt(v?.per_100000)}</td>
                  <td className="num muted">{fmt(v?.absolute_numbers)}</td>
                  <td className="num"><TrendBadge pct={pct} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-hint">на 100 тыс. · абсолютное · к {prevYear ?? "—"}</div>
      </div>

      {/* ── Trend chart + forecast controls ── */}
      <div className="card">
        <div className="card-header">
          <h3>Динамика · {diseaseLabel}</h3>
        </div>

        {/* Forecast method pills */}
        <div className="forecast-pills">
          {FORECAST_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              className={"forecast-pill" + (forecastMode === key ? " on" : "")}
              onClick={() => setForecastMode(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <LineChart
          labels={extLabels}
          series={series}
          height={200}
          forecastFrom={forecastMode !== "none" ? histLen : undefined}
        />
      </div>

      {/* ── Context metrics ── */}
      <div className="card">
        <div className="card-header">
          <h3>Контекст · {year}</h3>
        </div>
        <div className="grid2">
          <div className="metric">
            <div className="k">Родившихся</div>
            <div className="v">{fmt(births)}</div>
            <TrendBadge pct={trendPct(births, birthsPrev)} invert />
          </div>
          <div className="metric">
            <div className="k">Безопасная вода, %</div>
            <div className="v">{fmt(water?.safe_water_pct)}</div>
            <TrendBadge
              pct={trendPct(water?.safe_water_pct, waterPrev?.safe_water_pct)}
              invert
            />
          </div>
          <div className="metric">
            <div className="k">Хим. нарушения воды, %</div>
            <div className="v">{fmt(water?.chem_violation_pct)}</div>
            <TrendBadge
              pct={trendPct(water?.chem_violation_pct, waterPrev?.chem_violation_pct)}
            />
          </div>
          <div className="metric">
            <div className="k">Выбросы, кт</div>
            <div className="v">{fmt(em?.total_kt)}</div>
            <TrendBadge pct={trendPct(em?.total_kt, emPrev?.total_kt)} />
          </div>
        </div>
      </div>
    </div>
  );
}
