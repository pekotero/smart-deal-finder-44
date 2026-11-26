// Promos por cantidad de una sucursal ("2° al 70%", "3x2", "2 x $1.000"), de los datos SEPA.

export interface QtyPromo {
  text: string;
  unitPrice: number; // precio por unidad llevando minQty
  minQty: number;
}

// Promo de una fila de precios (null si no tiene o no tiene sentido).
export function qtyPromoFrom(row: { price: number | string; promo_text?: string | null; promo_price?: number | string | null; promo_min_qty?: number | null }): QtyPromo | undefined {
  const unit = Number(row.promo_price);
  const min = Number(row.promo_min_qty);
  if (!row.promo_text || !(unit > 0) || !(min >= 2) || !(unit < Number(row.price))) return undefined;
  return { text: row.promo_text, unitPrice: unit, minQty: min };
}

// Lo que se paga por qty unidades: la promo se aplica por cada grupo completo de minQty.
export function lineCost(price: number, qty: number, promo?: QtyPromo | null) {
  if (!promo || qty < promo.minQty) return price * qty;
  const groups = Math.floor(qty / promo.minQty);
  return groups * promo.minQty * promo.unitPrice + (qty - groups * promo.minQty) * price;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

// "2° al 70%: $3.894 c/u llevando 2".
export const qtyPromoLabel = (p: QtyPromo) => `${p.text}: ${money(p.unitPrice)} c/u llevando ${p.minQty}`;
