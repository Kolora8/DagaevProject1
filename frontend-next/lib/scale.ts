// Единая цветовая шкала для карты и легенды (синий = мало, красный = много).
export function colorFor(
  value: number | null,
  domain: [number, number]
): string {
  if (value == null || !isFinite(value)) return "#243a5e"; // нет данных
  const [min, max] = domain;
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0.5;
  const hue = 210 - 210 * t; // 210 (синий) -> 0 (красный)
  return `hsl(${hue}, 72%, 52%)`;
}

// диапазон значений per_100000 по всем регионам для болезни/года
export function computeDomain(
  values: (number | null)[]
): [number, number] {
  const v = values.filter((x): x is number => x != null && isFinite(x));
  if (!v.length) return [0, 1];
  return [Math.min(...v), Math.max(...v)];
}
