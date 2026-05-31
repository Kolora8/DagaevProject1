export interface Region {
  id: number;
  code: string;
  name: string;
  federal_okrug: string;
  population: number;
  grid_x: number;
  grid_y: number;
  life_expectancy?: number | null;
  doctors_per_10k?: number | null;
}

export interface Indicator {
  period: string;
  hospitals: number;
  doctors_per_10k: number;
  beds_per_10k: number;
  life_expectancy: number;
  incidence_rate: number;
}

export interface Forecast {
  id: number;
  horizon_year: number;
  metric: string;
  value: number;
  unit: string;
  note: string;
}

export interface Device {
  id: number;
  name: string;
  category: string;
  quantity: number;
  status: string;
}

export interface RegionDetail {
  region: Region;
  indicators: Indicator | null;
  forecasts: Forecast[];
  devices: Device[];
}
