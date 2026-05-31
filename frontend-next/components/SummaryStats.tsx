"use client";

import { RegionData } from "@/lib/dataset";

export default function SummaryStats({
  regions,
  getRegionValue,
  formatValue,
}: {
  regions: RegionData[];
  getRegionValue: (r: RegionData | undefined) => number | null;
  formatValue: (v: number | null) => string;
}) {
  const pairs = regions
    .map((r) => ({ r, v: getRegionValue(r) }))
    .filter((x): x is { r: RegionData; v: number } => x.v != null);

  const count = pairs.length;
  const avg = count ? pairs.reduce((s, x) => s + x.v, 0) / count : null;
  const maxEntry = pairs.reduce<{ r: RegionData; v: number } | null>(
    (best, x) => (!best || x.v > best.v ? x : best),
    null
  );
  const minEntry = pairs.reduce<{ r: RegionData; v: number } | null>(
    (best, x) => (!best || x.v < best.v ? x : best),
    null
  );

  return (
    <div className="stats-bar">
      <div className="stat-item">
        <div className="stat-k">Регионов с данными</div>
        <div className="stat-v">{count}</div>
      </div>
      <div className="stat-item">
        <div className="stat-k">Среднее</div>
        <div className="stat-v">{formatValue(avg)}</div>
      </div>
      <div className="stat-item stat-item--wide">
        <div className="stat-k">Максимум</div>
        <div className="stat-v">{formatValue(maxEntry?.v ?? null)}</div>
        <div className="stat-region">{maxEntry?.r.name ?? "—"}</div>
      </div>
      <div className="stat-item stat-item--wide">
        <div className="stat-k">Минимум</div>
        <div className="stat-v">{formatValue(minEntry?.v ?? null)}</div>
        <div className="stat-region">{minEntry?.r.name ?? "—"}</div>
      </div>
    </div>
  );
}
