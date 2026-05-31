import { Region, RegionDetail, Device } from "./types";
import {
  MOCK_REGIONS,
  mockDetail,
  mockAddDevice,
  mockUpdateForecast,
} from "./mock";

// Запросы идут на /api/* и проксируются на Go-бэкенд (см. next.config.js).
// Если бэкенд недоступен, клиент автоматически переключается на демо-данные.

export type Mode = "online" | "mock";

async function http<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch("/api" + path, opts);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json() as Promise<T>;
}

export async function fetchRegions(): Promise<{ data: Region[]; mode: Mode }> {
  try {
    const data = await http<Region[]>("/regions");
    return { data, mode: "online" };
  } catch {
    return { data: MOCK_REGIONS, mode: "mock" };
  }
}

export async function fetchRegion(id: number, mode: Mode): Promise<RegionDetail> {
  if (mode === "mock") return mockDetail(id);
  try {
    return await http<RegionDetail>("/regions/" + id);
  } catch {
    return mockDetail(id);
  }
}

export async function saveForecast(
  regionId: number,
  fid: number,
  value: number,
  note: string,
  mode: Mode
): Promise<void> {
  if (mode === "mock") {
    mockUpdateForecast(regionId, fid, value, note);
    return;
  }
  await http("/forecasts/" + fid, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, note }),
  });
}

export async function addDevice(
  regionId: number,
  dev: Omit<Device, "id">,
  mode: Mode
): Promise<Device> {
  if (mode === "mock") return mockAddDevice(regionId, dev);
  return http<Device>("/regions/" + regionId + "/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dev),
  });
}
