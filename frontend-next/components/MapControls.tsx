"use client";

import { DiseaseMeta } from "@/lib/dataset";

export default function MapControls({
  years,
  year,
  onYear,
  diseases,
  disease,
  onDisease,
  domain,
}: {
  years: string[];
  year: string;
  onYear: (y: string) => void;
  diseases: DiseaseMeta[];
  disease: string;
  onDisease: (d: string) => void;
  domain: [number, number];
}) {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  const fmt = (n: number) =>
    n >= 1000 ? Math.round(n).toLocaleString("ru-RU") : Math.round(n * 10) / 10;

  return (
    <div className="controls">
      <div className="ctl-row">
        <label className="ctl-label">Год</label>
        <select value={year} onChange={(e) => onYear(e.target.value)}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <div className="pills">
          {diseases.map((d) => (
            <button
              key={d.key}
              className={"pill" + (d.key === disease ? " on" : "")}
              onClick={() => onDisease(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="legend-bar">
        <span className="legend-cap">Заболеваемость на 100 тыс., {year}</span>
        <div className="legend-grad" />
        <div className="legend-ticks">
          {stops.map((s) => (
            <span key={s}>{fmt(domain[0] + (domain[1] - domain[0]) * s)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
