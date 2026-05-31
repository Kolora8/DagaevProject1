"use client";

import { useEffect, useMemo, useState } from "react";
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

function CtxMetric({
  label,
  value,
  pct,
  invert = false,
  full = false,
}: {
  label: string;
  value: number | null | undefined;
  pct?: number | null;
  invert?: boolean;
  full?: boolean;
}) {
  return (
    <div className={"metric" + (full ? " metric--full" : "")}>
      <div className="k">{label}</div>
      <div className="v">{fmt(value)}</div>
      {pct !== undefined && <TrendBadge pct={pct} invert={invert} />}
    </div>
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

  useEffect(() => {
    setForecastMode("none");
  }, [region.code, disease]);

  const { years, diseases } = data.meta;
  const diseaseLabel = diseases.find((d) => d.key === disease)?.label || disease;

  const yearIdx = years.indexOf(year);
  const prevYear = yearIdx > 0 ? years[yearIdx - 1] : null;

  const mYear = region.morbidity[year] || {};
  const mPrev = prevYear ? region.morbidity[prevYear] || {} : null;
  const water     = region.water_quality[year];
  const waterPrev = prevYear ? region.water_quality[prevYear] : null;
  const births     = region.births[year];
  const birthsPrev = prevYear ? region.births[prevYear] : null;
  const em     = region.emissions[year];
  const emPrev = prevYear ? region.emissions[prevYear] : null;

  const regionPoints = useMemo(
    () => years.map((y) => region.morbidity[y]?.[disease]?.per_100000 ?? null),
    [years, region.code, disease]
  );
  const rfPoints = useMemo(
    () => years.map((y) => data.rf.morbidity[y]?.[disease]?.per_100000 ?? null),
    [years, disease]
  );

  const forecastData = useMemo(() => {
    if (forecastMode === "none") return null;
    const clean = regionPoints.filter((v): v is number => v != null);
    if (clean.length < 2) return null;

    const resolvedKey: ForecastKey =
      forecastMode === "best" ? bestMethod(clean) : forecastMode;
    const values = computeForecast(clean, resolvedKey);
    const label = forecastMode === "best"
      ? `Прогноз · ${METHOD_LABELS[resolvedKey]}`
      : `Прогноз · ${METHOD_LABELS[resolvedKey]}`;
    return { values, label, resolvedKey };
  }, [forecastMode, regionPoints]);

  const histLen  = years.length;
  const extLabels = forecastMode !== "none" ? [...years, ...FORECAST_LABELS] : years;
  const extLen    = extLabels.length;

  const regionExt: (number | null)[] = forecastMode !== "none"
    ? [...regionPoints, ...Array(FORECAST_PERIODS).fill(null)]
    : regionPoints;

  const rfExt: (number | null)[] = forecastMode !== "none"
    ? [...rfPoints, ...Array(FORECAST_PERIODS).fill(null)]
    : rfPoints;

  const series: Series[] = [
    { label: region.name,      color: "#38bdf8", points: regionExt },
    { label: "РФ (в среднем)", color: "#f59e0b", points: rfExt },
  ];

  if (forecastData) {
    const lastHistIdx = regionPoints.reduceRight(
      (found, v, i) => (found === -1 && v != null ? i : found), -1
    );
    const lastHistVal = lastHistIdx >= 0 ? regionPoints[lastHistIdx] : null;

    const forecastPts: (number | null)[] = Array(extLen).fill(null);
    if (lastHistVal != null) forecastPts[lastHistIdx] = lastHistVal;
    forecastData.values.forEach((v, i) => { forecastPts[histLen + i] = v; });

    series.push({ label: forecastData.label, color: "#a78bfa", points: forecastPts, dashed: true });
  }

  return (
    <div>
      <h2 className="region-name">{region.name}</h2>
      <div className="region-meta">
        <span className="region-code">{region.code}</span>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Заболеваемость · на 100 тыс.</h3>
          <span className="legend-cap">{year}</span>
        </div>
        <table className="dtable">
          <tbody>
            {diseases.map((d) => {
              const v     = mYear[d.key];
              const vPrev = mPrev?.[d.key];
              return (
                <tr key={d.key} className={d.key === disease ? "row-on" : undefined}>
                  <td>{d.label}</td>
                  <td className="num">{fmt(v?.per_100000)}</td>
                  <td className="num muted">{fmt(v?.absolute_numbers)}</td>
                  <td className="num">
                    <TrendBadge pct={trendPct(v?.per_100000, vPrev?.per_100000)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-hint">на 100 тыс. · абсолютное · к {prevYear ?? "—"}</div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Динамика · {diseaseLabel}</h3>
        </div>

        <div className="forecast-pills">
          {FORECAST_BUTTONS.map(({ key, label }) => {
            const isActive = forecastMode === key;
            const displayLabel =
              isActive && key === "best" && forecastData
                ? `★ ${METHOD_LABELS[forecastData.resolvedKey]}`
                : label;
            return (
              <button
                key={key}
                className={"forecast-pill" + (isActive ? " on" : "")}
                onClick={() => setForecastMode(key)}
              >
                {displayLabel}
              </button>
            );
          })}
        </div>

        <LineChart
          labels={extLabels}
          series={series}
          height={200}
          forecastFrom={forecastMode !== "none" ? histLen : undefined}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Контекст · {year}</h3>
        </div>

        <div className="ctx-section">
          <div className="ctx-label">Демография</div>
          <div className="grid2">
            <CtxMetric
              label="Родившихся"
              value={births}
              pct={trendPct(births, birthsPrev)}
              invert
              full
            />
          </div>
        </div>

        <div className="ctx-section">
          <div className="ctx-label">Качество воды</div>
          <div className="grid2">
            <CtxMetric label="Безопасная вода, %" value={water?.safe_water_pct}
              pct={trendPct(water?.safe_water_pct, waterPrev?.safe_water_pct)} invert />
            <CtxMetric label="Хим. нарушения, %" value={water?.chem_violation_pct}
              pct={trendPct(water?.chem_violation_pct, waterPrev?.chem_violation_pct)} />
            <CtxMetric label="Микробиол. нарушения, %" value={water?.micro_violation_pct}
              pct={trendPct(water?.micro_violation_pct, waterPrev?.micro_violation_pct)} />
            <CtxMetric label="Водопроводы (несоотв.), %" value={water?.pipe_violation_pct}
              pct={trendPct(water?.pipe_violation_pct, waterPrev?.pipe_violation_pct)} />
          </div>
        </div>

        <div className="ctx-section">
          <div className="ctx-label">Выбросы</div>
          <div className="grid2">
            <CtxMetric label="Всего, кт" value={em?.total_kt}
              pct={trendPct(em?.total_kt, emPrev?.total_kt)} />
            <CtxMetric label="На душу, кг" value={em?.per_capita_kg}
              pct={trendPct(em?.per_capita_kg, emPrev?.per_capita_kg)} />
            <CtxMetric label="Стационарные, кт" value={em?.stationary_kt}
              pct={trendPct(em?.stationary_kt, emPrev?.stationary_kt)} />
            <CtxMetric label="Передвижные, кт" value={em?.mobile_kt}
              pct={trendPct(em?.mobile_kt, emPrev?.mobile_kt)} />
          </div>
        </div>
      </div>
    </div>
  );
}
