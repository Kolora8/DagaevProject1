"use client";

import { Dataset, RegionData } from "@/lib/dataset";
import LineChart, { Series } from "./LineChart";

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("ru-RU");

function trendPct(
  curr: number | null | undefined,
  prev: number | null | undefined
): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function TrendBadge({
  pct,
  invert = false,
}: {
  pct: number | null;
  invert?: boolean;
}) {
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

  const regionPoints = years.map(
    (y) => region.morbidity[y]?.[disease]?.per_100000 ?? null
  );
  const rfPoints = years.map(
    (y) => data.rf.morbidity[y]?.[disease]?.per_100000 ?? null
  );
  const series: Series[] = [
    { label: region.name, color: "#38bdf8", points: regionPoints },
    { label: "РФ (в среднем)", color: "#f59e0b", points: rfPoints },
  ];

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
              const v = mYear[d.key];
              const vPrev = mPrev?.[d.key];
              const pct = trendPct(v?.per_100000, vPrev?.per_100000);
              return (
                <tr
                  key={d.key}
                  className={d.key === disease ? "row-on" : undefined}
                >
                  <td>{d.label}</td>
                  <td className="num">{fmt(v?.per_100000)}</td>
                  <td className="num muted">{fmt(v?.absolute_numbers)}</td>
                  <td className="num">
                    <TrendBadge pct={pct} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-hint">
          на 100 тыс. · абсолютное · к {prevYear ?? "—"}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Динамика · {diseaseLabel}</h3>
        </div>
        <LineChart labels={years} series={series} />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Контекст · {year}</h3>
        </div>
        <div className="grid2">
          <div className="metric">
            <div className="k">Родившихся</div>
            <div className="v">{fmt(births)}</div>
            <TrendBadge
              pct={trendPct(births, birthsPrev)}
              invert={true}
            />
          </div>
          <div className="metric">
            <div className="k">Безопасная вода, %</div>
            <div className="v">{fmt(water?.safe_water_pct)}</div>
            <TrendBadge
              pct={trendPct(water?.safe_water_pct, waterPrev?.safe_water_pct)}
              invert={true}
            />
          </div>
          <div className="metric">
            <div className="k">Хим. нарушения воды, %</div>
            <div className="v">{fmt(water?.chem_violation_pct)}</div>
            <TrendBadge
              pct={trendPct(
                water?.chem_violation_pct,
                waterPrev?.chem_violation_pct
              )}
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
