"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Dataset, RegionData, loadDataset, per100k } from "@/lib/dataset";
import { computeDomain } from "@/lib/scale";
import MapControls, { type MapMode } from "@/components/MapControls";
import RegionDataPanel from "@/components/RegionDataPanel";
import SummaryStats from "@/components/SummaryStats";
import RegionRanking from "@/components/RegionRanking";
import LoadingScreen, { type CheckState } from "@/components/LoadingScreen";

const RussiaLeafletMap = dynamic(() => import("@/components/RussiaLeafletMap"), {
  ssr: false,
  loading: () => <div className="skeleton skeleton-map" />,
});

export default function Page() {
  const [data, setData] = useState<Dataset | null>(null);
  const [year, setYear] = useState("2023");
  const [disease, setDisease] = useState("congenital_anomalies");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<CheckState | undefined>(undefined);

  // Map data layer
  const [mapMode, setMapMode] = useState<MapMode>("morbidity");
  const [waterKey, setWaterKey] = useState("safe_water_pct");
  const [emissionsKey, setEmissionsKey] = useState("total_kt");

  useEffect(() => {
    loadDataset()
      .then((d) => {
        setData(d);
        setYear(d.meta.years[d.meta.years.length - 1]);
        setDisease(d.meta.diseases[0].key);
      })
      .catch(() => setData(null));
  }, []);

  // Generic value extractor — changes with mapMode and sub-key selectors
  const getRegionValue = useCallback(
    (r: RegionData | undefined): number | null => {
      if (!r) return null;
      switch (mapMode) {
        case "morbidity":
          return per100k(r, disease, year);
        case "water": {
          const w = r.water_quality[year];
          if (!w) return null;
          return waterKey === "safe_water_pct"
            ? w.safe_water_pct
            : w.chem_violation_pct;
        }
        case "emissions": {
          const e = r.emissions[year];
          if (!e) return null;
          return emissionsKey === "total_kt" ? e.total_kt : e.per_capita_kg;
        }
      }
    },
    [mapMode, disease, year, waterKey, emissionsKey]
  );

  const domain = useMemo<[number, number]>(() => {
    if (!data) return [0, 1];
    return computeDomain(data.regions.map((r) => getRegionValue(r)));
  }, [data, getRegionValue]);

  // For safe water %: higher = better = blue, so invert the color scale
  const invertColors = mapMode === "water" && waterKey === "safe_water_pct";

  const legendUnit = useMemo(() => {
    if (mapMode === "morbidity") return `На 100 тыс. населения · ${year}`;
    if (mapMode === "water")
      return waterKey === "safe_water_pct"
        ? `% безопасной воды · ${year}`
        : `% хим. нарушений · ${year}`;
    return emissionsKey === "total_kt"
      ? `Выбросы, кт · ${year}`
      : `Выбросы на душу, кг · ${year}`;
  }, [mapMode, waterKey, emissionsKey, year]);

  const formatValue = useCallback(
    (v: number | null | undefined): string => {
      if (v == null) return "—";
      if (mapMode === "morbidity")
        return v.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
      if (mapMode === "water") return `${v.toFixed(1)}%`;
      return emissionsKey === "total_kt"
        ? `${Math.round(v).toLocaleString("ru-RU")} кт`
        : `${Math.round(v).toLocaleString("ru-RU")} кг`;
    },
    [mapMode, emissionsKey]
  );

  // Used as the GeoJSON re-render key inside RussiaLeafletMap
  const valKey = `${mapMode}-${disease}-${year}-${waterKey}-${emissionsKey}`;

  const onSelect = useCallback((code: string) => setActiveCode(code), []);

  const active: RegionData | undefined = data?.regions.find(
    (r) => r.code === activeCode
  );

  async function handleCheck() {
    setCheckState("checking");
    // Enforce 2.5s minimum so the animation is always visible
    await Promise.all([
      fetch("/morbidity.json").then((r) => {
        if (!r.ok) throw new Error("not ok");
      }),
      new Promise<void>((r) => setTimeout(r, 2500)),
    ])
      .then(() => setCheckState("ok"))
      .catch(() => setCheckState("error"));
  }

  return (
    <>
      <LoadingScreen
        visible={data === null}
        checkState={checkState}
        onDismiss={() => setCheckState(undefined)}
      />

      <header>
        <div className="header-logo">
          <div className="header-logo-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5L13.5 4.25V8.5C13.5 11.5 11.2 14.2 8 15C4.8 14.2 2.5 11.5 2.5 8.5V4.25L8 1.5Z"
                stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
              />
              <path
                d="M5.5 8.25L7.25 10L10.5 6.5"
                stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="header-text">
            <h1>ЗдравМонитор</h1>
            <div className="sub">
              Заболеваемость врождёнными аномалиями по субъектам РФ · 2015–2023
            </div>
          </div>
        </div>

        {data && (
          <button
            className="header-check-btn"
            onClick={handleCheck}
            disabled={!!checkState}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4.5"
                stroke="currentColor" strokeWidth="1.5" />
              <line x1="9" y1="9" x2="12.5" y2="12.5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Проверить данные
          </button>
        )}

        <div className="status on">Данные: GISSS.RU</div>
      </header>

      <div className="wrap">
        <div className="mapwrap">
          {data ? (
            <>
              <MapControls
                years={data.meta.years}
                year={year}
                onYear={setYear}
                mapMode={mapMode}
                onMapMode={setMapMode}
                diseases={data.meta.diseases}
                disease={disease}
                onDisease={setDisease}
                waterKey={waterKey}
                onWaterKey={setWaterKey}
                emissionsKey={emissionsKey}
                onEmissionsKey={setEmissionsKey}
                domain={domain}
                legendUnit={legendUnit}
                invertColors={invertColors}
              />
              <SummaryStats
                regions={data.regions}
                getRegionValue={getRegionValue}
                formatValue={formatValue}
              />
              <RussiaLeafletMap
                regions={data.regions}
                getRegionValue={getRegionValue}
                formatValue={formatValue}
                invertColors={invertColors}
                valKey={valKey}
                domain={domain}
                activeCode={activeCode}
                onSelect={onSelect}
              />
            </>
          ) : (
            <div className="skeleton skeleton-map" />
          )}
        </div>

        <aside>
          {data && active ? (
            <RegionDataPanel
              region={active}
              data={data}
              disease={disease}
              year={year}
            />
          ) : data ? (
            <RegionRanking
              regions={data.regions}
              getRegionValue={getRegionValue}
              formatValue={formatValue}
              invertSort={invertColors}
              onSelect={onSelect}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}
