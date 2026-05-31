"use client";

import { RegionData, Dataset } from "@/lib/dataset";
import LineChart, { Series } from "./LineChart";

// Up to 6 regions, each gets a distinct color
const PALETTE = ["#38bdf8", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#fb923c"];

export default function ComparePanel({
  compareCodes,
  data,
  getSeriesValue,
  formatValue,
  legendUnit,
  year,
  onRemove,
  onClear,
  onClose,
}: {
  compareCodes: string[];
  data: Dataset;
  getSeriesValue: (r: RegionData, y: string) => number | null;
  formatValue: (v: number | null) => string;
  legendUnit: string;
  year: string;
  onRemove: (code: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { years } = data.meta;

  const selectedRegions = compareCodes
    .map((code) => data.regions.find((r) => r.code === code))
    .filter(Boolean) as RegionData[];

  const series: Series[] = selectedRegions.map((r, i) => ({
    label: r.name,
    color: PALETTE[i % PALETTE.length],
    points: years.map((y) => getSeriesValue(r, y)),
  }));

  // Sort table rows by descending current-year value
  const tableRows = selectedRegions
    .map((r, i) => ({ r, i, v: getSeriesValue(r, year) }))
    .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));

  return (
    <div className="compare-panel">

      {/* ── Header ── */}
      <div className="compare-header">
        <div className="compare-title">
          Сравнение
          {compareCodes.length > 0 && (
            <span className="compare-count">{compareCodes.length}</span>
          )}
        </div>
        <button className="compare-close" onClick={onClose} title="Выйти из режима сравнения">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1 L9 9 M9 1 L1 9"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {compareCodes.length === 0 ? (
        /* ── Empty state ── */
        <div className="compare-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="4" y="12" width="17" height="24" rx="3"
              stroke="#243862" strokeWidth="1.5" fill="#152236" />
            <rect x="27" y="12" width="17" height="24" rx="3"
              stroke="#243862" strokeWidth="1.5" fill="#152236" />
            <path d="M9 20h7M9 25h5M32 20h7M32 25h5"
              stroke="#4a6690" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M21.5 24h5"
              stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 1.5" />
          </svg>
          <p>Нажимайте на регионы на карте чтобы добавить в сравнение (до 6)</p>
        </div>
      ) : (
        <>
          {/* ── Region chips ── */}
          <div className="compare-chips">
            {selectedRegions.map((r, i) => (
              <div
                key={r.code}
                className="compare-chip"
                style={{ borderColor: PALETTE[i % PALETTE.length] }}
              >
                <span
                  className="chip-dot"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="chip-name">{r.name}</span>
                <button
                  className="chip-remove"
                  onClick={() => onRemove(r.code)}
                  title="Убрать из сравнения"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 1 L7 7 M7 1 L1 7"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* ── Trend chart (needs ≥ 2 regions) ── */}
          {compareCodes.length >= 2 && (
            <div className="compare-card">
              <div className="card-header">
                <h3>Динамика</h3>
                <span className="legend-cap">{legendUnit}</span>
              </div>
              <LineChart labels={years} series={series} height={200} />
            </div>
          )}

          {/* ── Comparison table — current year ── */}
          <div className="compare-card">
            <div className="card-header">
              <h3>Значения · {year}</h3>
            </div>
            <table className="dtable">
              <tbody>
                {tableRows.map(({ r, i, v }) => (
                  <tr key={r.code}>
                    <td>
                      <span
                        className="chip-dot"
                        style={{
                          background: PALETTE[i % PALETTE.length],
                          display: "inline-block",
                          marginRight: 7,
                          verticalAlign: "middle",
                        }}
                      />
                      {r.name}
                    </td>
                    <td className="num">{formatValue(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Clear button ── */}
          <button className="compare-clear-btn" onClick={onClear}>
            Очистить выбор
          </button>
        </>
      )}
    </div>
  );
}
