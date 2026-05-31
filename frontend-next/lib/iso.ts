// Сопоставление наших кратких кодов регионов с ISO 3166-2:RU,
// которые используются в SVG-картах (например, amCharts): RU-MOW, RU-SPE …
const OVERRIDES: Record<string, string> = {
  TAT: "RU-TA", // Республика Татарстан
  BAS: "RU-BA", // Республика Башкортостан
};

export function codeToIso(code: string): string {
  return (OVERRIDES[code] || "RU-" + code).toUpperCase();
}
