"use client";

import { DiseaseMeta } from "@/lib/dataset";

export type MapMode = "morbidity" | "water" | "emissions";

const MODE_LABELS: Record<MapMode, string> = {
  morbidity: "Заболеваемость",
  water:     "Качество воды",
  emissions: "Выбросы",
};

const WATER_KEYS = [
  { key: "safe_water_pct",      label: "Безопасная вода" },
  { key: "chem_violation_pct",  label: "Хим. загрязнения" },
  { key: "micro_violation_pct", label: "Микробиол. нарушения" },
  { key: "pipe_violation_pct",  label: "Водопроводы (несоотв.)" },
];

const EMISSIONS_KEYS = [
  { key: "total_kt",      label: "Всего, кт" },
  { key: "per_capita_kg", label: "На душу, кг" },
  { key: "stationary_kt", label: "Стационарные" },
  { key: "mobile_kt",     label: "Передвижные" },
];

export default function MapControls({
  years, year, onYear,
  mapMode, onMapMode,
  diseases, disease, onDisease,
  waterKey, onWaterKey,
  emissionsKey, onEmissionsKey,
  domain, legendUnit, invertColors,
}: {
  years: string[];
  year: string;
  onYear: (y: string) => void;
  mapMode: MapMode;
  onMapMode: (m: MapMode) => void;
  diseases: DiseaseMeta[];
  disease: string;
  onDisease: (d: string) => void;
  waterKey: string;
  onWaterKey: (k: string) => void;
  emissionsKey: string;
  onEmissionsKey: (k: string) => void;
  domain: [number, number];
  legendUnit: string;
  invertColors: boolean;
}) {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  const fmt = (n: number) =>
    n >= 1000 ? Math.round(n).toLocaleString("ru-RU") : +(n.toFixed(1));

  return (
    <div className="controls">

      {/* ── Map data mode tabs ── */}
      <div className="ctl-row">
        <span className="ctl-label">Слой</span>
        <div className="pills">
          {(["morbidity", "water", "emissions"] as MapMode[]).map((m) => (
            <button
              key={m}
              className={"pill" + (m === mapMode ? " on" : "")}
              onClick={() => onMapMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Year pills ── */}
      <div className="ctl-row">
        <span className="ctl-label">Год</span>
        <div className="pills">
          {years.map((y) => (
            <button
              key={y}
              className={"pill" + (y === year ? " on" : "")}
              onClick={() => onYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sub-metric selector — changes per mode ── */}
      {mapMode === "morbidity" && (
        <div className="ctl-row">
          <span className="ctl-label">Показатель</span>
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
      )}

      {mapMode === "water" && (
        <div className="ctl-row">
          <span className="ctl-label">Метрика</span>
          <div className="pills">
            {WATER_KEYS.map((w) => (
              <button
                key={w.key}
                className={"pill" + (w.key === waterKey ? " on" : "")}
                onClick={() => onWaterKey(w.key)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mapMode === "emissions" && (
        <div className="ctl-row">
          <span className="ctl-label">Метрика</span>
          <div className="pills">
            {EMISSIONS_KEYS.map((e) => (
              <button
                key={e.key}
                className={"pill" + (e.key === emissionsKey ? " on" : "")}
                onClick={() => onEmissionsKey(e.key)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="legend-bar">
        <span className="legend-cap">{legendUnit}</span>
        {/* Mirror gradient for metrics where higher = better (safe water) */}
        <div
          className="legend-grad"
          style={invertColors ? { transform: "scaleX(-1)" } : undefined}
        />
        <div className="legend-ticks">
          {stops.map((s, i) => (
            <span key={i}>{fmt(domain[0] + (domain[1] - domain[0]) * s)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
