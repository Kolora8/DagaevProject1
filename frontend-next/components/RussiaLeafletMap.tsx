"use client";

import { useEffect, useState } from "react";
import { MapContainer, GeoJSON } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature, FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import { RegionData } from "@/lib/dataset";
import { matchByName } from "@/lib/regionMatch";
import { colorFor } from "@/lib/scale";

const GEOJSON_LOCAL = "/russia.geojson";
const GEOJSON_REMOTE =
  "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/russia.geojson";

// Фикс антимеридиана (Чукотка): восточная часть РФ пересекает 180° и её долготы
// становятся отрицательными — Leaflet рисует их в левой части карты.
// Ни один регион РФ не лежит западнее 0°, поэтому к отрицательным долготам
// безопасно прибавить 360°, чтобы вернуть «уехавшие» куски к материку.
function fixAntimeridian(node: unknown): void {
  if (!Array.isArray(node)) return;
  if (typeof node[0] === "number") {
    if ((node[0] as number) < 0) node[0] = (node[0] as number) + 360;
    return;
  }
  for (const child of node) fixAntimeridian(child);
}

export default function RussiaLeafletMap({
  regions,
  getRegionValue,
  formatValue,
  invertColors,
  valKey,
  domain,
  activeCode,
  onSelect,
  compareMode = false,
  compareCodes = [],
  onCompareToggle,
}: {
  regions: RegionData[];
  getRegionValue: (r: RegionData | undefined) => number | null;
  formatValue: (v: number | null) => string;
  invertColors: boolean;
  valKey: string;
  domain: [number, number];
  activeCode: string | null;
  onSelect: (code: string) => void;
  compareMode?: boolean;
  compareCodes?: string[];
  onCompareToggle?: (code: string) => void;
}) {
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const url of [GEOJSON_LOCAL, GEOJSON_REMOTE]) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const json = (await res.json()) as FeatureCollection;
          if (json?.features?.length) {
            json.features.forEach((f) =>
              fixAntimeridian(
                (f.geometry as { coordinates?: unknown })?.coordinates
              )
            );
            if (alive) setGeo(json);
            return;
          }
        } catch {
          /* следующий источник */
        }
      }
      if (alive) setError(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const styleFn = (feature?: Feature): PathOptions => {
    const name = (feature?.properties?.name as string) || "";
    const r = matchByName(name, regions);
    const value = getRegionValue(r);

    if (compareMode) {
      const inSet = !!r && compareCodes.includes(r.code);
      return {
        fillColor: colorFor(value, domain, invertColors),
        color: inSet ? "#38bdf8" : "#0e1b33",
        weight: inSet ? 2.5 : 0.4,
        fillOpacity: r ? (inSet ? 0.95 : 0.38) : 0.15,
      };
    }

    const active = !!r && r.code === activeCode;
    return {
      fillColor: colorFor(value, domain, invertColors),
      color: active ? "#ffffff" : "#0e1b33",
      weight: active ? 2.4 : 0.6,
      fillOpacity: r ? 0.92 : 0.5,
    };
  };

  const onEach = (feature: Feature, layer: Layer) => {
    const name = (feature.properties?.name as string) || "";
    const r = matchByName(name, regions);
    const value = getRegionValue(r);
    const label =
      (r?.name || name) + (value != null ? `: ${formatValue(value)}` : "");
    layer.bindTooltip(label, { sticky: true });
    if (r) {
      if (compareMode && onCompareToggle) {
        layer.on("click", () => onCompareToggle(r.code));
      } else {
        layer.on("click", () => onSelect(r.code));
        if (r.code === activeCode)
          (layer as unknown as { bringToFront: () => void }).bringToFront();
      }
    }
  };

  if (error) {
    return (
      <div className="map-note">
        Не удалось загрузить геоданные. Положите файл{" "}
        <code>public/russia.geojson</code> или проверьте доступ к сети.
      </div>
    );
  }
  if (!geo) return <div className="map-note">Загрузка карты…</div>;

  return (
    <MapContainer
      className="leaflet-russia"
      center={[64, 100]}
      zoom={3}
      minZoom={2}
      maxZoom={7}
      attributionControl={false}
      worldCopyJump={false}
    >
      <GeoJSON
        key={`${valKey}-${activeCode ?? "none"}`}
        data={geo}
        style={styleFn}
        onEachFeature={onEach}
      />
    </MapContainer>
  );
}
