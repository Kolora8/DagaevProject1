"use client";

import { useEffect, useRef, useState } from "react";
import { Region } from "@/lib/types";
import { codeToIso } from "@/lib/iso";
import RussiaMap from "./RussiaMap";

type Status = "loading" | "ready" | "missing";

export default function RussiaMapSvg({
  regions,
  activeId,
  onSelect,
}: {
  regions: Region[];
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const ref = useRef<HTMLDivElement>(null);

  // Загружаем файл карты из public/russia.svg один раз.
  useEffect(() => {
    let alive = true;
    fetch("/russia.svg")
      .then((r) => {
        if (!r.ok) throw new Error("no map");
        return r.text();
      })
      .then((text) => {
        if (!alive) return;
        // простая проверка, что это действительно SVG
        if (!text.includes("<svg")) throw new Error("not svg");
        setSvg(text);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("missing"));
    return () => {
      alive = false;
    };
  }, []);

  // Вставляем SVG и навешиваем поведение на регионы.
  useEffect(() => {
    if (status !== "ready" || !svg || !ref.current) return;
    const host = ref.current;
    host.innerHTML = svg;

    const svgEl = host.querySelector("svg");
    if (svgEl) {
      svgEl.removeAttribute("width");
      svgEl.removeAttribute("height");
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svgEl.style.width = "100%";
      svgEl.style.height = "auto";
      svgEl.style.display = "block";
    }

    // карта: ISO id (в верхнем регистре) -> регион из БД
    const byIso = new Map<string, Region>();
    regions.forEach((r) => byIso.set(codeToIso(r.code), r));

    const setFill = (el: Element, color: string) => {
      (el as HTMLElement).style.fill = color;
      el.querySelectorAll("path, polygon").forEach(
        (p) => ((p as HTMLElement).style.fill = color)
      );
    };

    host.querySelectorAll("[id]").forEach((el) => {
      const iso = (el.getAttribute("id") || "").toUpperCase();
      const region = byIso.get(iso);
      el.classList.add("rg");
      if (!region) {
        el.classList.add("rg-empty");
        return;
      }
      el.classList.add("rg-data");
      (el as HTMLElement).style.cursor = "pointer";
      el.addEventListener("click", () => onSelect(region.id));

      const active = region.id === activeId;
      el.classList.toggle("rg-active", active);
      setFill(el, active ? "#4f9dff" : "#2f5e9e");

      // подпись при наведении
      let title = el.querySelector<SVGTitleElement>("title");
      if (!title) {
        title = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "title"
        ) as SVGTitleElement;
        el.appendChild(title);
      }
      const le = region.life_expectancy ? `, ОПЖ ${region.life_expectancy}` : "";
      title.textContent = region.name + le;
    });
  }, [status, svg, regions, activeId, onSelect]);

  if (status === "missing") {
    // файла карты ещё нет — показываем плиточную карту
    return (
      <>
        <div className="map-note">
          Файл <code>public/russia.svg</code> не найден — показана упрощённая
          плиточная карта. Добавьте файл, чтобы увидеть реальные границы.
        </div>
        <RussiaMap regions={regions} activeId={activeId} onSelect={onSelect} />
      </>
    );
  }

  return <div className="svgmap" ref={ref} aria-label="Карта России" />;
}
