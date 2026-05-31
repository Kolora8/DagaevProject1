"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Dataset, RegionData, loadDataset, per100k } from "@/lib/dataset";
import { computeDomain } from "@/lib/scale";
import MapControls from "@/components/MapControls";
import RegionDataPanel from "@/components/RegionDataPanel";

const RussiaLeafletMap = dynamic(() => import("@/components/RussiaLeafletMap"), {
  ssr: false,
  loading: () => <div className="skeleton skeleton-map" />,
});

function SkeletonLoader() {
  return (
    <>
      <div className="skeleton skeleton-ctrl" />
      <div className="skeleton skeleton-map" />
    </>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="26" cy="26" r="25" stroke="#243862" strokeWidth="1" />
        <path
          d="M26 10C19.37 10 14 15.37 14 22C14 31.5 26 42 26 42C26 42 38 31.5 38 22C38 15.37 32.63 10 26 10Z"
          fill="#1a2d4a"
          stroke="#243862"
          strokeWidth="1.5"
        />
        <circle cx="26" cy="21" r="4.5" stroke="#38bdf8" strokeWidth="1.5" fill="none" opacity="0.65" />
        <circle cx="26" cy="21" r="1.5" fill="#38bdf8" opacity="0.5" />
      </svg>
      <p>Выберите регион на карте</p>
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<Dataset | null>(null);
  const [year, setYear] = useState("2023");
  const [disease, setDisease] = useState("congenital_anomalies");
  const [activeCode, setActiveCode] = useState<string | null>(null);

  useEffect(() => {
    loadDataset()
      .then((d) => {
        setData(d);
        setYear(d.meta.years[d.meta.years.length - 1]);
        setDisease(d.meta.diseases[0].key);
      })
      .catch(() => setData(null));
  }, []);

  const domain = useMemo<[number, number]>(() => {
    if (!data) return [0, 1];
    return computeDomain(data.regions.map((r) => per100k(r, disease, year)));
  }, [data, disease, year]);

  const onSelect = useCallback((code: string) => setActiveCode(code), []);

  const active: RegionData | undefined = data?.regions.find(
    (r) => r.code === activeCode
  );

  return (
    <>
      <header>
        <div className="header-logo">
          <div className="header-logo-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5L13.5 4.25V8.5C13.5 11.5 11.2 14.2 8 15C4.8 14.2 2.5 11.5 2.5 8.5V4.25L8 1.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M5.5 8.25L7.25 10L10.5 6.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
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
                diseases={data.meta.diseases}
                disease={disease}
                onDisease={setDisease}
                domain={domain}
              />
              <RussiaLeafletMap
                regions={data.regions}
                disease={disease}
                year={year}
                domain={domain}
                activeCode={activeCode}
                onSelect={onSelect}
              />
            </>
          ) : (
            <SkeletonLoader />
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
          ) : (
            <EmptyState />
          )}
        </aside>
      </div>
    </>
  );
}
