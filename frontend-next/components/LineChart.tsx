"use client";

import { useState } from "react";

export interface Series {
  label: string;
  color: string;
  points: (number | null)[];
}

export default function LineChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  // ViewBox matches the container closely:
  // aside=460px, aside-padding=20×2=40, card-padding=16×2=32 → ~388px rendered.
  // W=400 gives scale ≈ 0.97 — nearly 1:1, so font/dot sizes are accurate.
  const W = 400;
  const H = height;
  const padL = 46;
  const padB = 26;
  const padT = 14;
  const padR = 12;

  const [hover, setHover] = useState<{ si: number; pi: number } | null>(null);

  const all = series.flatMap((s) =>
    s.points.filter((p): p is number => p != null)
  );
  const rawMin = all.length ? Math.min(...all) : 0;
  const rawMax = all.length ? Math.max(...all) : 1;
  const rawRange = rawMax - rawMin || 2;

  // Add 8% padding above and below so lines never touch the chart edges.
  const lo = rawMin - rawRange * 0.08;
  const hi = rawMax + rawRange * 0.08;
  const range = hi - lo;

  const x = (i: number) =>
    padL + (i * (W - padL - padR)) / Math.max(1, labels.length - 1);
  const y = (v: number) =>
    padT + (H - padT - padB) * (1 - (v - lo) / range);

  const linePath = (pts: (number | null)[]) => {
    let d = "";
    pts.forEach((p, i) => {
      if (p == null) return;
      d += (d === "" ? "M" : "L") + x(i).toFixed(1) + "," + y(p).toFixed(1);
    });
    return d;
  };

  const areaPath = (pts: (number | null)[]) => {
    const valid = pts
      .map((p, i) => (p != null ? { v: p, i } : null))
      .filter(Boolean) as { v: number; i: number }[];
    if (!valid.length) return "";
    let d = `M${x(valid[0].i).toFixed(1)},${y(valid[0].v).toFixed(1)}`;
    for (let k = 1; k < valid.length; k++) {
      d += ` L${x(valid[k].i).toFixed(1)},${y(valid[k].v).toFixed(1)}`;
    }
    const bottom = H - padB;
    d += ` L${x(valid[valid.length - 1].i).toFixed(1)},${bottom}`;
    d += ` L${x(valid[0].i).toFixed(1)},${bottom} Z`;
    return d;
  };

  // 4 evenly spaced ticks on the Y axis.
  const yticks = [0, 1 / 3, 2 / 3, 1].map((t) => lo + range * t);

  const fmt = (n: number) =>
    n >= 1000 ? Math.round(n).toLocaleString("ru-RU") : Math.round(n * 10) / 10;

  const hoverVal =
    hover != null ? (series[hover.si]?.points[hover.pi] ?? null) : null;

  const monoStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono, 'DM Mono', monospace)",
  };

  return (
    <div className="linechart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="linechart"
        role="img"
      >
        <defs>
          {series.map((s, si) => (
            <linearGradient
              key={si}
              id={`area-grad-${si}`}
              x1="0"
              y1={padT}
              x2="0"
              y2={H - padB}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal gridlines + Y labels */}
        {yticks.map((v, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(v)}
              y2={y(v)}
              strokeWidth="0.8"
              strokeDasharray="3 5"
              style={{ stroke: "#243862" }}
            />
            <text
              x={padL - 6}
              y={y(v) + 4}
              fontSize="11"
              textAnchor="end"
              style={{ fill: "#7b9dc8", ...monoStyle }}
            >
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* X-axis labels — every year since there are only ~9 */}
        {labels.map((l, i) => (
          <text
            key={l}
            x={x(i)}
            y={H - 7}
            fontSize="10"
            textAnchor="middle"
            style={{ fill: "#7b9dc8", ...monoStyle }}
          >
            {l}
          </text>
        ))}

        {/* Area fills */}
        {series.map((s, si) => (
          <path
            key={`area-${si}`}
            d={areaPath(s.points)}
            fill={`url(#area-grad-${si})`}
          />
        ))}

        {/* Lines */}
        {series.map((s, si) => (
          <path
            key={`line-${si}`}
            d={linePath(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Data point dots */}
        {series.map((s, si) =>
          s.points.map((p, pi) =>
            p != null ? (
              <circle
                key={`dot-${si}-${pi}`}
                cx={x(pi)}
                cy={y(p)}
                r={4}
                fill={s.color}
                strokeWidth="2"
                className="chart-dot"
                style={{ stroke: "#0f1826" }}
                onMouseEnter={() => setHover({ si, pi })}
                onMouseLeave={() => setHover(null)}
              />
            ) : null
          )
        )}

        {/* Hover tooltip */}
        {hover !== null &&
          hoverVal !== null &&
          (() => {
            const cx = x(hover.pi);
            const cy = y(hoverVal);
            const text = `${labels[hover.pi]}: ${fmt(hoverVal)}`;
            const tw = text.length * 6.2 + 20;
            const tx = Math.max(padL, Math.min(W - padR - tw, cx - tw / 2));
            const ty = cy > padT + 36 ? cy - 32 : cy + 12;
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={tx}
                  y={ty}
                  width={tw}
                  height={20}
                  rx="4"
                  strokeWidth="1"
                  style={{ fill: "#1a2d4a", stroke: "#38bdf8" }}
                />
                <text
                  x={tx + tw / 2}
                  y={ty + 13.5}
                  fontSize="10"
                  textAnchor="middle"
                  style={{ fill: "#e2ecff", ...monoStyle }}
                >
                  {text}
                </text>
              </g>
            );
          })()}
      </svg>

      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
