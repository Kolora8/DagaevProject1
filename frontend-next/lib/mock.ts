import { Region, RegionDetail, Device } from "./types";

// Демо-данные на случай, когда Go-бэкенд недоступен.
export const MOCK_REGIONS: Region[] = [
  { id: 1, code: "MOW", name: "Москва", federal_okrug: "Центральный", population: 13100000, grid_x: 5, grid_y: 3 },
  { id: 2, code: "MOS", name: "Московская область", federal_okrug: "Центральный", population: 8500000, grid_x: 5, grid_y: 2 },
  { id: 3, code: "SPE", name: "Санкт-Петербург", federal_okrug: "Северо-Западный", population: 5600000, grid_x: 4, grid_y: 1 },
  { id: 4, code: "LEN", name: "Ленинградская область", federal_okrug: "Северо-Западный", population: 2000000, grid_x: 4, grid_y: 0 },
  { id: 5, code: "KDA", name: "Краснодарский край", federal_okrug: "Южный", population: 5800000, grid_x: 4, grid_y: 5 },
  { id: 6, code: "ROS", name: "Ростовская область", federal_okrug: "Южный", population: 4200000, grid_x: 5, grid_y: 5 },
  { id: 7, code: "TAT", name: "Республика Татарстан", federal_okrug: "Приволжский", population: 3900000, grid_x: 7, grid_y: 3 },
  { id: 8, code: "NIZ", name: "Нижегородская область", federal_okrug: "Приволжский", population: 3200000, grid_x: 6, grid_y: 3 },
  { id: 9, code: "SAM", name: "Самарская область", federal_okrug: "Приволжский", population: 3200000, grid_x: 7, grid_y: 4 },
  { id: 10, code: "SVE", name: "Свердловская область", federal_okrug: "Уральский", population: 4300000, grid_x: 9, grid_y: 2 },
  { id: 11, code: "CHE", name: "Челябинская область", federal_okrug: "Уральский", population: 3400000, grid_x: 9, grid_y: 3 },
  { id: 12, code: "NVS", name: "Новосибирская область", federal_okrug: "Сибирский", population: 2800000, grid_x: 11, grid_y: 3 },
  { id: 13, code: "KYA", name: "Красноярский край", federal_okrug: "Сибирский", population: 2900000, grid_x: 10, grid_y: 2 },
  { id: 14, code: "IRK", name: "Иркутская область", federal_okrug: "Сибирский", population: 2400000, grid_x: 12, grid_y: 3 },
  { id: 15, code: "PRI", name: "Приморский край", federal_okrug: "Дальневосточный", population: 1900000, grid_x: 14, grid_y: 4 },
  { id: 16, code: "KHA", name: "Хабаровский край", federal_okrug: "Дальневосточный", population: 1300000, grid_x: 14, grid_y: 3 },
  { id: 17, code: "VOR", name: "Воронежская область", federal_okrug: "Центральный", population: 2300000, grid_x: 5, grid_y: 4 },
  { id: 18, code: "BAS", name: "Республика Башкортостан", federal_okrug: "Приволжский", population: 4000000, grid_x: 8, grid_y: 3 },
];

const cache: Record<number, RegionDetail> = {};
const rnd = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 10) / 10;

export function mockDetail(id: number): RegionDetail {
  if (cache[id]) return cache[id];
  const r = MOCK_REGIONS.find((x) => x.id === id)!;
  const d: RegionDetail = {
    region: r,
    indicators: {
      period: "2026-Q1",
      hospitals: Math.round(40 + r.population / 200000),
      doctors_per_10k: rnd(38, 58),
      beds_per_10k: rnd(70, 110),
      life_expectancy: rnd(70, 76),
      incidence_rate: rnd(600, 1000),
    },
    forecasts: [
      { id: r.id * 100 + 1, horizon_year: 2027, metric: "Ожидаемая продолжительность жизни", value: rnd(72, 77), unit: "лет", note: "Базовый сценарий" },
      { id: r.id * 100 + 2, horizon_year: 2027, metric: "Обеспеченность врачами", value: rnd(42, 60), unit: "на 10 тыс.", note: "Целевой показатель нацпроекта" },
    ],
    devices: [
      { id: r.id * 1000 + 1, name: "Аппарат ИВЛ", category: "ИВЛ", quantity: Math.round(5 + Math.random() * 20), status: "в эксплуатации" },
    ],
  };
  // дополним краткие поля для карты
  r.life_expectancy = d.indicators!.life_expectancy;
  r.doctors_per_10k = d.indicators!.doctors_per_10k;
  cache[id] = d;
  return d;
}

export function mockAddDevice(id: number, dev: Omit<Device, "id">): Device {
  const created: Device = { ...dev, id: Date.now() };
  mockDetail(id).devices.push(created);
  return created;
}

export function mockUpdateForecast(regionId: number, fid: number, value: number, note: string) {
  const f = mockDetail(regionId).forecasts.find((x) => x.id === fid);
  if (f) {
    f.value = value;
    f.note = note;
  }
}
