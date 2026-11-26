// Historial de precios: un punto por cadena y día, para el gráfico del detalle de producto.

export interface HistoryPoint {
  chain: string;
  storeId?: string;
  date: string; // YYYY-MM-DD
  price: number;
}

// Orden fijo de colores por cadena: el color sigue a la cadena, no a su posición en el gráfico.
const CHAIN_ORDER = ["Coto", "Carrefour", "Día", "Jumbo", "Disco", "Vea", "ChangoMás", "PedidosYa Market"];
export const MAX_SERIES = 8;

export function chainColor(chain: string, chains: string[]) {
  const fixed = CHAIN_ORDER.indexOf(chain);
  // Las cadenas fuera del orden fijo toman los lugares que quedan libres en este gráfico.
  const taken = new Set(chains.map((c) => CHAIN_ORDER.indexOf(c)).filter((i) => i >= 0));
  const free = [...Array(MAX_SERIES).keys()].filter((i) => !taken.has(i));
  const extra = chains.filter((c) => CHAIN_ORDER.indexOf(c) < 0);
  const slot = fixed >= 0 ? fixed : free[extra.indexOf(chain)] ?? MAX_SERIES - 1;
  return `var(--series-${slot + 1})`;
}

// Filas del gráfico: una por fecha, con el precio de cada cadena ese día. Si una cadena no
// tiene precio ese día, repite el último conocido (el precio sigue vigente hasta que cambia).
export function historyRows(points: HistoryPoint[], chains: string[]) {
  const dates = [...new Set(points.map((p) => p.date))].sort();
  const byKey = new Map(points.map((p) => [`${p.chain}|${p.date}`, p.price]));
  const last: Record<string, number | undefined> = {};
  return dates.map((date) => {
    const row: Record<string, string | number | undefined> = { date };
    for (const c of chains) {
      const v = byKey.get(`${c}|${date}`);
      if (v != null) last[c] = v;
      row[c] = last[c];
    }
    return row;
  });
}

// Cambio del mejor precio entre el primer y el último día registrados (negativo = bajó).
export function bestPriceChange(points: HistoryPoint[], chains: string[]) {
  const rows = historyRows(points, chains);
  if (rows.length < 2) return null;
  const best = (r: Record<string, unknown>) =>
    Math.min(...chains.map((c) => r[c]).filter((v): v is number => typeof v === "number"));
  const first = best(rows[0]);
  const lastBest = best(rows[rows.length - 1]);
  if (!isFinite(first) || !isFinite(lastBest)) return null;
  return { from: first, to: lastBest, pct: Math.round(((lastBest - first) / first) * 100) };
}

export type DealVerdict =
  | { kind: "fake"; usual: number; days: number } // muestra descuento pero es el precio de siempre
  | { kind: "lowest"; usual: number; days: number } // el más bajo del período
  | { kind: "below"; usual: number; days: number; pct: number }
  | { kind: "above"; usual: number; days: number; pct: number }
  | { kind: "usual"; usual: number; days: number };

const DAY = 86400000;

// ¿La oferta es real? Compara el mejor precio de hoy con el habitual (la mediana del mejor precio
// de cada día en los últimos `windowDays`, sin contar hoy). null si hay pocos días para saberlo.
export function dealVerdict(
  points: HistoryPoint[],
  chains: string[],
  current: number,
  discounted: boolean,
  windowDays = 60,
  minDays = 5,
): DealVerdict | null {
  const rows = historyRows(points, chains);
  if (rows.length < 2 || !(current > 0)) return null;
  const lastDate = String(rows[rows.length - 1].date);
  const from = new Date(new Date(lastDate).getTime() - windowDays * DAY).toISOString().slice(0, 10);
  const past = rows
    .filter((r) => String(r.date) < lastDate && String(r.date) >= from)
    .map((r) => Math.min(...chains.map((c) => r[c]).filter((v): v is number => typeof v === "number")))
    .filter((v) => isFinite(v));
  // Días cubiertos (los días sin cambios no tienen fila: se cuentan por fecha).
  const firstDate = rows.find((r) => String(r.date) >= from)?.date;
  const days = firstDate ? Math.round((new Date(lastDate).getTime() - new Date(String(firstDate)).getTime()) / DAY) : 0;
  if (!past.length || days < minDays) return null;
  const sorted = [...past].sort((a, b) => a - b);
  const usual = sorted[Math.floor(sorted.length / 2)];
  const pct = Math.round(((current - usual) / usual) * 100);
  if (discounted && current >= usual * 0.97) return { kind: "fake", usual, days };
  if (current < sorted[0]) return { kind: "lowest", usual, days };
  if (pct <= -5) return { kind: "below", usual, days, pct: -pct };
  if (pct >= 5) return { kind: "above", usual, days, pct };
  return { kind: "usual", usual, days };
}
