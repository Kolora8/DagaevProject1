"use client";

import { Region } from "@/lib/types";

export default function RussiaMap({
  regions,
  activeId,
  onSelect,
}: {
  regions: Region[];
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="map">
      {regions.map((r) => {
        const le = r.life_expectancy ? "ОПЖ " + r.life_expectancy : "";
        return (
          <button
            key={r.id}
            type="button"
            className={"tile" + (activeId === r.id ? " active" : "")}
            title={r.name}
            style={{ gridColumn: r.grid_x + 1, gridRow: r.grid_y + 1 }}
            onClick={() => onSelect(r.id)}
          >
            <span className="code">{r.code}</span>
            <span className="val">{le}</span>
          </button>
        );
      })}
    </div>
  );
}
