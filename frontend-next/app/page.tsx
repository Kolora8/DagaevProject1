"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Dataset, RegionData, loadDataset, per100k } from "@/lib/dataset";
import { computeDomain } from "@/lib/scale";
import MapControls from "@/components/MapControls";
import RegionDataPanel from "@/components/RegionDataPanel";

// Leaflet работает только в браузере — подключаем без SSR.
const RussiaLeafletMap = dynamic(() => import("@/components/RussiaLeafletMap"), {
  ssr: false,
  loading: () => <div className="map-note">Загрузка карты…</div>,
});

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
    return computeDomain(
      data.regions.map((r) => per100k(r, disease, year))
    );
  }, [data, disease, year]);

  const onSelect = useCallback((code: string) => setActiveCode(code), []);

  const active: RegionData | undefined = data?.regions.find(
    (r) => r.code === activeCode
  );

  return (
    <>
      <header>
        <div>
          <h1>ЗдравМонитор</h1>
          <div className="sub">
            Заболеваемость врождёнными аномалиями и сопутствующие показатели по
            субъектам РФ · 2015–2023
          </div>
        </div>
        <div className="status on">Данные: GISSS.RU (реальные)</div>
      </header>

      <div className="wrap">
        <div className="mapwrap">
          {data && (
            <MapControls
              years={data.meta.years}
              year={year}
              onYear={setYear}
              diseases={data.meta.diseases}
              disease={disease}
              onDisease={setDisease}
              domain={domain}
            />
          )}
          {data ? (
            <RussiaLeafletMap
              regions={data.regions}
              disease={disease}
              year={year}
              domain={domain}
              activeCode={activeCode}
              onSelect={onSelect}
            />
          ) : (
            <div className="map-note">Загрузка данных…</div>
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
            <div className="empty">← Выберите регион на карте</div>
          )}
        </aside>
      </div>
    </>
  );
}
