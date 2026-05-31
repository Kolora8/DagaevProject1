"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Dataset, RegionData, loadDataset, per100k } from "@/lib/dataset";
import { computeDomain } from "@/lib/scale";
import MapControls, { type MapMode } from "@/components/MapControls";
import RegionDataPanel from "@/components/RegionDataPanel";
import SummaryStats from "@/components/SummaryStats";
import RegionRanking from "@/components/RegionRanking";
import ComparePanel from "@/components/ComparePanel";
import LoadingScreen, { type CheckState } from "@/components/LoadingScreen";

const RussiaLeafletMap = dynamic(() => import("@/components/RussiaLeafletMap"), {
  ssr: false,
  loading: () => <div className="skeleton skeleton-map" />,
});

const MAX_COMPARE = 6;

export default function Page() {
  const [data, setData]             = useState<Dataset | null>(null);
  const [year, setYear]             = useState("2023");
  const [disease, setDisease]       = useState("congenital_anomalies");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<CheckState | undefined>(undefined);

  // Map data layer
  const [mapMode, setMapMode]         = useState<MapMode>("morbidity");
  const [waterKey, setWaterKey]       = useState("safe_water_pct");
  const [emissionsKey, setEmissionsKey] = useState("total_kt");

  // Compare mode
  const [compareMode, setCompareMode]   = useState(false);
  const [compareCodes, setCompareCodes] = useState<string[]>([]);

  useEffect(() => {
    loadDataset()
      .then((d) => {
        setData(d);
        setYear(d.meta.years[d.meta.years.length - 1]);
        setDisease(d.meta.diseases[0].key);
      })
      .catch(() => setData(null));
  }, []);

  // Base value extractor that accepts year explicitly — used for time-series in ComparePanel
  const getSeriesValue = useCallback(
    (r: RegionData, y: string): number | null => {
      switch (mapMode) {
        case "morbidity":
          return per100k(r, disease, y);
        case "water": {
          const w = r.water_quality[y];
          if (!w) return null;
          if (waterKey === "safe_water_pct")      return w.safe_water_pct;
          if (waterKey === "chem_violation_pct")  return w.chem_violation_pct;
          if (waterKey === "micro_violation_pct") return w.micro_violation_pct;
          if (waterKey === "pipe_violation_pct")  return w.pipe_violation_pct;
          return null;
        }
        case "emissions": {
          const e = r.emissions[y];
          if (!e) return null;
          if (emissionsKey === "total_kt")      return e.total_kt;
          if (emissionsKey === "per_capita_kg") return e.per_capita_kg;
          if (emissionsKey === "stationary_kt") return e.stationary_kt;
          if (emissionsKey === "mobile_kt")     return e.mobile_kt;
          return null;
        }
      }
    },
    [mapMode, disease, waterKey, emissionsKey]
  );

  // Single-year value for map coloring / stats bar / ranking
  const getRegionValue = useCallback(
    (r: RegionData | undefined): number | null =>
      r ? getSeriesValue(r, year) : null,
    [getSeriesValue, year]
  );

  const domain = useMemo<[number, number]>(() => {
    if (!data) return [0, 1];
    return computeDomain(data.regions.map((r) => getRegionValue(r)));
  }, [data, getRegionValue]);

  // safe_water_pct and pipe_violation_pct (compliant %) → higher is better → invert color scale
  const invertColors =
    mapMode === "water" &&
    (waterKey === "safe_water_pct" || waterKey === "pipe_violation_pct");

  // Absolute-number getter for the morbidity ranking column toggle
  const getAbsoluteValue = useMemo(() => {
    if (mapMode !== "morbidity") return undefined;
    return (r: RegionData | undefined): number | null =>
      r?.morbidity[year]?.[disease]?.absolute_numbers ?? null;
  }, [mapMode, year, disease]);

  const legendUnit = useMemo(() => {
    if (mapMode === "morbidity") return `На 100 тыс. населения · ${year}`;
    if (mapMode === "water") {
      const waterLabels: Record<string, string> = {
        safe_water_pct:      `% безопасной воды · ${year}`,
        chem_violation_pct:  `% хим. нарушений · ${year}`,
        micro_violation_pct: `% микробиол. нарушений · ${year}`,
        pipe_violation_pct:  `% несоотв. водопроводов · ${year}`,
      };
      return waterLabels[waterKey] ?? `% · ${year}`;
    }
    const emissionsLabels: Record<string, string> = {
      total_kt:      `Выбросы всего, кт · ${year}`,
      per_capita_kg: `Выбросы на душу, кг · ${year}`,
      stationary_kt: `Стационарные выбросы, кт · ${year}`,
      mobile_kt:     `Передвижные выбросы, кт · ${year}`,
    };
    return emissionsLabels[emissionsKey] ?? `Выбросы · ${year}`;
  }, [mapMode, waterKey, emissionsKey, year]);

  const formatValue = useCallback(
    (v: number | null | undefined): string => {
      if (v == null) return "—";
      if (mapMode === "morbidity")
        return v.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
      if (mapMode === "water") return `${v.toFixed(1)}%`;
      return emissionsKey === "per_capita_kg"
        ? `${Math.round(v).toLocaleString("ru-RU")} кг`
        : `${Math.round(v).toLocaleString("ru-RU")} кт`;
    },
    [mapMode, emissionsKey]
  );

  // GeoJSON key — includes compare set so the layer re-renders when selection changes
  const valKey = compareMode
    ? `cmp-${compareCodes.slice().sort().join(",")}-${mapMode}-${year}-${waterKey}-${emissionsKey}`
    : `${mapMode}-${disease}-${year}-${waterKey}-${emissionsKey}`;

  const onSelect = useCallback((code: string) => setActiveCode(code), []);

  const onCompareToggle = useCallback((code: string) => {
    setCompareCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, code];
    });
  }, []);

  function enterCompareMode() {
    setCompareMode(true);
    setActiveCode(null);
  }

  function exitCompareMode() {
    setCompareMode(false);
    setCompareCodes([]);
  }

  const active: RegionData | undefined = data?.regions.find(
    (r) => r.code === activeCode
  );

  async function handleCheck() {
    setCheckState("checking");
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

              {/* ── Compare mode bar ── */}
              <div className="compare-bar">
                {!compareMode ? (
                  <button className="compare-enter-btn" onClick={enterCompareMode}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="2" width="5" height="10" rx="1.5"
                        stroke="currentColor" strokeWidth="1.4" />
                      <rect x="8" y="2" width="5" height="10" rx="1.5"
                        stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    Сравнить регионы
                  </button>
                ) : (
                  <div className="compare-bar-active">
                    <span className="compare-bar-info">
                      <span className="compare-bar-dot" />
                      Режим сравнения
                      {compareCodes.length > 0 && (
                        <span className="compare-bar-badge">
                          {compareCodes.length}/{MAX_COMPARE}
                        </span>
                      )}
                    </span>
                    <span className="compare-bar-hint">
                      {compareCodes.length === 0
                        ? "Нажмите на регионы на карте"
                        : compareCodes.length === 1
                        ? "Выберите ещё один регион"
                        : "Нажмите на регион чтобы добавить или убрать"}
                    </span>
                    <button className="compare-exit-btn" onClick={exitCompareMode}>
                      Выйти
                    </button>
                  </div>
                )}
              </div>

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
                compareMode={compareMode}
                compareCodes={compareCodes}
                onCompareToggle={onCompareToggle}
              />
            </>
          ) : (
            <div className="skeleton skeleton-map" />
          )}
        </div>

        <aside>
          {compareMode && data ? (
            <ComparePanel
              compareCodes={compareCodes}
              data={data}
              getSeriesValue={getSeriesValue}
              formatValue={formatValue}
              legendUnit={legendUnit}
              year={year}
              onRemove={(code) =>
                setCompareCodes((prev) => prev.filter((c) => c !== code))
              }
              onClear={() => setCompareCodes([])}
              onClose={exitCompareMode}
            />
          ) : data && active ? (
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
              getAbsoluteValue={getAbsoluteValue}
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
