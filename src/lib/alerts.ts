// Reglas de las alertas de precio. Las usa la app (para mostrar el estado) y el script diario
// que avisa (scraper/check-alerts.ts), así las dos miran lo mismo.

export type AlertKind = "any" | "target" | "percent";

export interface AlertRule {
  kind: AlertKind;
  base_price: number; // mejor precio cuando se creó
  target_price?: number | null;
  percent?: number | null;
  notified_price?: number | null; // precio del último aviso
}

export const PERCENT_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

// Precio al que se cumple la alerta (o menos).
export function alertThreshold(a: AlertRule): number {
  if (a.kind === "target" && a.target_price) return Number(a.target_price);
  if (a.kind === "percent" && a.percent) return Number(a.base_price) * (1 - Number(a.percent) / 100);
  // Cualquier baja: un peso menos que el precio de cuando se creó.
  return Number(a.base_price) - 1;
}

export function alertMet(a: AlertRule, best: number | null | undefined): boolean {
  return best != null && best > 0 && best <= alertThreshold(a);
}

// Avisar si se cumple y todavía no se avisó a este precio o a uno menor: si sigue bajando se
// vuelve a avisar, si queda igual no.
export function shouldNotify(a: AlertRule, best: number | null | undefined): boolean {
  if (!alertMet(a, best)) return false;
  return a.notified_price == null || best! < Number(a.notified_price);
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

export function describeRule(a: AlertRule): string {
  if (a.kind === "target" && a.target_price) return `Cuando llegue a ${money(Number(a.target_price))}`;
  if (a.kind === "percent" && a.percent) return `Cuando baje ${a.percent}% (a ${money(alertThreshold(a))})`;
  return `Ante cualquier baja de ${money(Number(a.base_price))}`;
}

// Texto del aviso.
export function alertMessage(productName: string, a: AlertRule, best: number, store: string) {
  const drop = a.base_price > best ? Math.round(((a.base_price - best) / a.base_price) * 100) : 0;
  return {
    title: `Bajó ${productName}`,
    body: `Está a ${money(best)} en ${store}${drop > 0 ? ` (${drop}% menos que ${money(a.base_price)})` : ""}.`,
  };
}

export interface AlertPriceRow {
  store_id: string;
  price: number | string;
  store_name?: string | null;
}

// Mejor precio para una alerta: el más bajo entre las tiendas que mira (todas si no tiene).
export function bestForAlert(rows: AlertPriceRow[], storeIds?: string[] | null) {
  const allowed = storeIds?.length ? new Set(storeIds) : null;
  let best: AlertPriceRow | null = null;
  for (const r of rows) {
    if (allowed && !allowed.has(r.store_id)) continue;
    if (!(Number(r.price) > 0)) continue;
    if (!best || Number(r.price) < Number(best.price)) best = r;
  }
  return best ? { price: Number(best.price), storeId: best.store_id, storeName: best.store_name || "" } : null;
}
