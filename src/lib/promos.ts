// Promociones bancarias: filtros por medio de pago, día, vigencia y cadena.
// Misma lógica que el "buscador de precios" (index.html), adaptada a las tiendas de la app.

export interface BankPromo {
  id: string;
  medio: string;
  cadena: string;
  aplica_a: string[];
  dias: string[];
  descuento: number | null;
  tipo: string | null;
  tope: number | null;
  tope_periodo: string | null;
  minimo_compra: number | null;
  requisitos: string | null;
  online: boolean | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  fuente: string | null;
  confianza: string | null;
}

export const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
// Lunes primero, para los selectores.
export const WEEK = [1, 2, 3, 4, 5, 6, 0].map((i) => DAYS[i]);

export const norm = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const fmtMoney = (n: number) => {
  const d = Number.isInteger(n) ? 0 : 2;
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const today = (now = new Date()) => DAYS[now.getDay()];

// Las cuotas sin interés no bajan el precio: no cuentan como descuento.
export const isDiscount = (p: BankPromo) => (p.descuento ?? 0) > 0 && !/cuota/i.test(p.tipo || "");

export const payOk = (p: BankPromo, medios: string[]) => medios.includes(p.medio);

export const dayOk = (p: BankPromo, day: string) =>
  !p.dias || !p.dias.length || p.dias.map(norm).includes(norm(day));

// Fecha del próximo día elegido (hoy si es ese día), como "YYYY-MM-DD".
export function shoppingDate(day: string, now = new Date()) {
  const d = new Date(now);
  for (let i = 0; i < 7 && DAYS[d.getDay()] !== day; i++) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateOk(p: BankPromo, day: string, now = new Date()) {
  const date = shoppingDate(day, now);
  return (!p.vigencia_desde || p.vigencia_desde <= date) && (!p.vigencia_hasta || p.vigencia_hasta >= date);
}

const GENERIC_FORMATS = /^(tiendas|sucursales|sucursales fisicas|locales|tienda fisica)$/;

// "Carrefour" tiene que matchear "Carrefour Market", pero "DIA" no tiene que matchear "Diarco".
export function chainOk(p: BankPromo, storeName: string) {
  const c = norm(p.cadena);
  if (c === "todas") return true;
  const text = norm(storeName);
  const word = (w: string) =>
    (" " + text + " ").includes(" " + w + " ") ||
    (w.length >= 5 && text.replace(/ /g, "").includes(w.replace(/ /g, "")));
  if (!word(c)) return false;
  if (!p.aplica_a || !p.aplica_a.length) return true;
  // aplica_a lista formatos ("Carrefour Market"): la tienda tiene que nombrar alguno.
  return p.aplica_a.some((a) => {
    const n = norm(a).replace(c, "").trim();
    return !n || GENERIC_FORMATS.test(n) || word(n);
  });
}

export interface PromoFilters {
  medios: string[];
  day: string;
  now?: Date;
}

// Promos con descuento real que valen para los medios y el día elegidos.
export function activePromos(promos: BankPromo[], { medios, day, now }: PromoFilters) {
  return promos.filter((p) => isDiscount(p) && payOk(p, medios) && dayOk(p, day) && dateOk(p, day, now));
}

// La promo presencial con mayor descuento para una tienda. Con `total`, la que más ahorra
// respetando tope y compra mínima (las que sólo fallan por el mínimo vuelven como `missing`).
export function bestPromoForStore(
  promos: BankPromo[],
  storeName: string,
  filters: PromoFilters,
  total?: number,
): { promo: BankPromo; save: number | null; missing?: number } | null {
  let best: { promo: BankPromo; save: number | null } | null = null;
  let almost: BankPromo | null = null;
  for (const p of activePromos(promos, filters)) {
    if (p.online === true || !chainOk(p, storeName)) continue;
    if (total == null) {
      const d = p.descuento ?? 0;
      const bestD = best?.promo.descuento ?? 0;
      // A igual descuento gana la promo propia de la cadena sobre una de "Todas" (cualquier súper).
      const moreSpecific = best && norm(best.promo.cadena) === "todas" && norm(p.cadena) !== "todas";
      if (!best || d > bestD || (d === bestD && moreSpecific)) best = { promo: p, save: null };
      continue;
    }
    if (p.minimo_compra && total < p.minimo_compra) {
      if (!almost || p.minimo_compra < (almost.minimo_compra ?? Infinity)) almost = p;
      continue;
    }
    let save = (total * (p.descuento ?? 0)) / 100;
    if (p.tope) save = Math.min(save, p.tope);
    if (!best || save > (best.save ?? 0)) best = { promo: p, save };
  }
  if (best) return best;
  return almost ? { promo: almost, save: 0, missing: almost.minimo_compra! - total! } : null;
}

// "Galicia 20% reintegro (tope $20.000 por mes)"
export function promoLabel(p: BankPromo) {
  const tope = p.tope ? ` (tope ${fmtMoney(p.tope)}${p.tope_periodo ? " por " + p.tope_periodo : ""})` : "";
  return `${p.medio} ${p.descuento}%${p.tipo === "reintegro" ? " reintegro" : ""}${tope}${p.confianza === "baja" ? " ¿?" : ""}`;
}

// Promo para una cadena de la app. Las tiendas de PedidosYa sólo toman promos de PedidosYa (las
// del súper en el local no valen comprando por la app) y las demás no toman las de PedidosYa.
export function bestPromoForChain(promos: BankPromo[], chain: string, filters: PromoFilters, total: number) {
  const online = /pedidosya/i.test(chain);
  const list = promos.filter((p) => norm(p.cadena).includes("pedidosya") === online);
  return bestPromoForStore(list, chain, filters, total);
}
