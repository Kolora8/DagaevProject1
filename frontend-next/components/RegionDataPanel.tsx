"use client";

import { Dataset, RegionData } from "@/lib/dataset";
import LineChart, { Series } from "./LineChart";

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("ru-RU");

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
  const diseaseLabel =
    diseases.find((d) => d.key === disease)?.label || disease;

  const mYear = region.morbidity[year] || {};
  const water = region.water_quality[year];
  const births = region.births[year];
  const em = region.emissions[year];

  // динамика выбранной болезни: регион vs РФ
  const regionPoints = years.map(
    (y) => region.morbidity[y]?.[disease]?.per_100000 ?? null
  );
  const rfPoints = years.map(
    (y) => data.rf.morbidity[y]?.[disease]?.per_100000 ?? null
  );
  const series: Series[] = [
    { label: region.name, color: "#4f9dff", points: regionPoints },
    { label: "РФ (в среднем)", color: "#fbbf24", points: rfPoints },
  ];

  return (
    <div>
      <h2>{region.name}</h2>
      <div className="okrug">Код: {region.code}</div>

      <div className="card">
        <h3>Заболеваемость · {year} · на 100 тыс.</h3>
        <table className="dtable">
          <tbody>
            {diseases.map((d) => {
              const v = mYear[d.key];
              return (
                <tr
                  key={d.key}
                  className={d.key === disease ? "row-on" : undefined}
                >
                  <td>{d.label}</td>
                  <td className="num">{fmt(v?.per_100000)}</td>
                  <td className="num muted">{fmt(v?.absolute_numbers)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="thint">столбцы: на 100 тыс. · абсолютное число</div>
      </div>

      <div className="card">
        <h3>Динамика · {diseaseLabel}</h3>
        <LineChart labels={years} series={series} />
      </div>

      <div className="card">
        <h3>Контекст · {year}</h3>
        <div className="grid2">
          <div className="metric">
            <div className="k">Родившихся</div>
            <div className="v">{fmt(births)}</div>
          </div>
          <div className="metric">
            <div className="k">Безопасная вода, %</div>
            <div className="v">{fmt(water?.safe_water_pct)}</div>
          </div>
          <div className="metric">
            <div className="k">Хим. нарушения воды, %</div>
            <div className="v">{fmt(water?.chem_violation_pct)}</div>
          </div>
          <div className="metric">
            <div className="k">Выбросы, кт</div>
            <div className="v">{fmt(em?.total_kt)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
