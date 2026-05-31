"use client";

// Простой линейный график на SVG, без внешних зависимостей.
export interface Series {
  label: string;
  color: string;
  points: (number | null)[];
}

export default function LineChart({
  labels,
  series,
  height = 180,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const W = 460;
  const H = height;
  const padL = 46;
  const padB = 22;
  const padT = 10;
  const padR = 10;

  const all = series.flatMap((s) =>
    s.points.filter((p): p is number => p != null)
  );
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const lo = min === max ? min - 1 : min;
  const hi = min === max ? max + 1 : max;

  const x = (i: number) =>
    padL + (i * (W - padL - padR)) / Math.max(1, labels.length - 1);
  const y = (v: number) =>
    padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));

  const path = (pts: (number | null)[]) => {
    let d = "";
    pts.forEach((p, i) => {
      if (p == null) return;
      d += (d === "" ? "M" : "L") + x(i).toFixed(1) + "," + y(p).toFixed(1);
    });
    return d;
  };

  const yticks = [0, 0.5, 1].map((t) => lo + (hi - lo) * t);
  const fmt = (n: number) =>
    n >= 1000 ? Math.round(n).toLocaleString("ru-RU") : Math.round(n * 10) / 10;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="linechart" role="img">
        {yticks.map((v, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(v)}
              y2={y(v)}
              stroke="#27395f"
              strokeWidth="0.6"
            />
            <text x={4} y={y(v) + 3} fill="#9fb0d0" fontSize="9">
              {fmt(v)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % 2 === 0 || i === labels.length - 1 ? (
            <text
              key={l}
              x={x(i)}
              y={H - 6}
              fill="#9fb0d0"
              fontSize="9"
              textAnchor="middle"
            >
              {l}
            </text>
          ) : null
        )}
        {series.map((s) => (
          <path
            key={s.label}
            d={path(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
          />
        ))}
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
