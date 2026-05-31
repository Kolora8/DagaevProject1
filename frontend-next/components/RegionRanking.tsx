"use client";

import { RegionData } from "@/lib/dataset";

export default function RegionRanking({
  regions,
  getRegionValue,
  formatValue,
  invertSort,
  onSelect,
}: {
  regions: RegionData[];
  getRegionValue: (r: RegionData | undefined) => number | null;
  formatValue: (v: number | null) => string;
  invertSort: boolean; // true = lowest first (e.g. least safe water = worst at top)
  onSelect: (code: string) => void;
}) {
  const ranked = [...regions]
    .map((r) => ({ r, v: getRegionValue(r) }))
    .filter((x): x is { r: RegionData; v: number } => x.v != null)
    .sort((a, b) => (invertSort ? a.v - b.v : b.v - a.v));

  return (
    <div className="ranking">
      <div className="ranking-title">Рейтинг регионов</div>
      <div className="ranking-hint">Нажмите на регион для подробной информации</div>
      <div className="ranking-list">
        {ranked.map((item, i) => (
          <button
            key={item.r.code}
            className="rank-row"
            onClick={() => onSelect(item.r.code)}
          >
            <span className="rank-pos">{i + 1}</span>
            <span className="rank-name">{item.r.name}</span>
            <span className="rank-val">{formatValue(item.v)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
