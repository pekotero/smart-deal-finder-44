// Planes de compra para el carrito: todo en un super, o repartido entre dos.
import type { CartItem } from "@/hooks/useCart";

// Promo que aplica a una cadena para un subtotal (null si ninguna). La arma quien llama, con las
// promos, los medios de pago y el día elegidos.
export type PromoFor = (chain: string, subtotal: number) => { save: number | null } | null;

export interface StorePart {
  chain: string;
  items: CartItem[];
  subtotal: number;
  save: number;
  final: number;
}

export interface Plan {
  parts: StorePart[];
  final: number;
  // Productos que ninguna de las cadenas del plan tiene.
  missing: CartItem[];
}

const priceIn = (item: CartItem, chain: string) => item.prices.find((p) => p.store === chain)?.price;

function part(chain: string, items: CartItem[], promoFor: PromoFor): StorePart {
  const subtotal = items.reduce((s, i) => s + priceIn(i, chain)! * i.qty, 0);
  const save = promoFor(chain, subtotal)?.save ?? 0;
  return { chain, items, subtotal, save, final: subtotal - save };
}

// Cada producto va a la cadena del plan donde está más barato; después se aplica la promo de cada
// cadena sobre su subtotal (así se respetan topes y compras mínimas).
export function planFor(items: CartItem[], chains: string[], promoFor: PromoFor): Plan {
  const byChain = new Map<string, CartItem[]>(chains.map((c) => [c, []]));
  const missing: CartItem[] = [];
  for (const item of items) {
    let best: string | null = null;
    for (const c of chains) {
      const p = priceIn(item, c);
      if (p != null && (best == null || p < priceIn(item, best)!)) best = c;
    }
    if (best) byChain.get(best)!.push(item);
    else missing.push(item);
  }
  const parts = chains.filter((c) => byChain.get(c)!.length).map((c) => part(c, byChain.get(c)!, promoFor));
  return { parts, final: parts.reduce((s, p) => s + p.final, 0), missing };
}

const better = (a: Plan, b: Plan | null) => !b || a.missing.length < b.missing.length || (a.missing.length === b.missing.length && a.final < b.final);

// El mejor plan en un solo super (primero el que tiene más productos, después el más barato).
export function bestSingle(items: CartItem[], chains: string[], promoFor: PromoFor): Plan | null {
  let best: Plan | null = null;
  for (const c of chains) {
    const p = planFor(items, [c], promoFor);
    if (better(p, best)) best = p;
  }
  return best;
}

// El mejor plan repartido entre dos supers. Sólo cuenta si los dos se llevan algo.
export function bestSplit(items: CartItem[], chains: string[], promoFor: PromoFor): Plan | null {
  let best: Plan | null = null;
  for (let i = 0; i < chains.length; i++) {
    for (let j = i + 1; j < chains.length; j++) {
      const p = planFor(items, [chains[i], chains[j]], promoFor);
      if (p.parts.length === 2 && better(p, best)) best = p;
    }
  }
  return best;
}

// Máximo ahorro: cada producto en el súper donde está más barato, sin límite de supers. Sólo se
// devuelve si usa más de dos (si no, ya es el de un super o el repartido).
export function bestEverywhere(items: CartItem[], chains: string[], promoFor: PromoFor): Plan | null {
  const p = planFor(items, chains, promoFor);
  return p.parts.length > 2 ? p : null;
}

export function chainsIn(items: CartItem[]) {
  return [...new Set(items.flatMap((i) => i.prices.map((p) => p.store)))];
}
