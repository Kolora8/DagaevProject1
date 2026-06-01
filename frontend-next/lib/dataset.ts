// Типы и загрузка реального набора данных (из проекта GISSS.RU / mapdata.js).

export interface DiseaseMeta {
  key: string;
  label: string;
}

export interface MorbidityVal {
  absolute_numbers: number;
  per_100000: number;
}

export interface WaterVal {
  safe_water_pct: number;
  chem_violation_pct: number;
  micro_violation_pct: number;
  pipe_violation_pct: number;
}

export interface EmissionsVal {
  total_kt: number;
  per_capita_kg: number;
  stationary_kt: number;
  mobile_kt: number;
}

export interface RegionData {
  code: string;
  name: string;
  morbidity: Record<string, Record<string, MorbidityVal>>; // year -> disease -> value
  births: Record<string, number>;
  water_quality: Record<string, WaterVal>;
  emissions: Record<string, EmissionsVal>;
}

export interface Dataset {
  meta: { years: string[]; diseases: DiseaseMeta[] };
  rf: { morbidity: Record<string, Record<string, MorbidityVal>> };
  regions: RegionData[];
}

export async function loadDataset(): Promise<Dataset> {
  const res = await fetch("/api/dataset");
  if (!res.ok) throw new Error("dataset API недоступен");
  return res.json();
}

// значение per_100000 для региона/болезни/года (или null)
export function per100k(
  r: RegionData | undefined,
  disease: string,
  year: string
): number | null {
  const v = r?.morbidity?.[year]?.[disease];
  return v ? v.per_100000 : null;
}
