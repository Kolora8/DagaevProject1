"use client";

import { useState } from "react";
import { RegionData } from "@/lib/dataset";

export default function RegionRanking({
  regions,
  getRegionValue,
  getAbsoluteValue,
  formatValue,
  invertSort,
  onSelect,
}: {
  regions: RegionData[];
  getRegionValue: (r: RegionData | undefined) => number | null;
  getAbsoluteValue?: (r: RegionData | undefined) => number | null;
  formatValue: (v: number | null) => string;
  invertSort: boolean;
  onSelect: (code: string) => void;
}) {
  const [showAbsolute, setShowAbsolute] = useState(false);

  const useAbsolute = showAbsolute && !!getAbsoluteValue;

  const ranked = [...regions]
    .map((r) => ({ r, v: getRegionValue(r), abs: getAbsoluteValue?.(r) ?? null }))
    .filter((x): x is { r: RegionData; v: number; abs: number | null } => x.v != null)
    .sort((a, b) => {
      const av = useAbsolute ? (a.abs ?? a.v) : a.v;
      const bv = useAbsolute ? (b.abs ?? b.v) : b.v;
      return invertSort ? av - bv : bv - av;
    });

  return (
    <div className="ranking">
      <div className="ranking-header">
        <div className="ranking-title">Рейтинг регионов</div>

        {getAbsoluteValue && (
          <div className="pills" style={{ gap: 3 }}>
            <button
              className={"pill" + (!showAbsolute ? " on" : "")}
              style={{ padding: "3px 8px", fontSize: 11 }}
              onClick={() => setShowAbsolute(false)}
            >
              На 100 тыс.
            </button>
            <button
              className={"pill" + (showAbsolute ? " on" : "")}
              style={{ padding: "3px 8px", fontSize: 11 }}
              onClick={() => setShowAbsolute(true)}
            >
              Абс. число
            </button>
          </div>
        )}
      </div>

      <div className="ranking-hint">Нажмите на регион для подробной информации</div>

      <div className="ranking-list">
        {ranked.map((item, i) => {
          const display = useAbsolute
            ? item.abs != null
              ? Math.round(item.abs).toLocaleString("ru-RU")
              : "—"
            : formatValue(item.v);
          return (
            <button
              key={item.r.code}
              className="rank-row"
              onClick={() => onSelect(item.r.code)}
            >
              <span className="rank-pos">{i + 1}</span>
              <span className="rank-name">{item.r.name}</span>
              <span className="rank-val">{display}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
