// Qué precio se muestra de cada cadena. Hay dos fuentes:
// - online: los scrapers guardan un precio por cadena en una sola tienda (price_source 'online');
//   se muestra en la sucursal más cercana de esa cadena.
// - local: precios de una sucursal cercana (SEPA o cargados por usuarios). Ganan sobre el online
//   porque son los de esa góndola; entre varias sucursales, la más cercana.
import { chainOf, isOnlineChain } from "./chains";
import { qtyPromoFrom, type QtyPromo } from "./qty-promo";

export interface SourceStore {
  id: string;
  name: string;
  price_source?: string | null;
  distance?: number;
  address?: string | null;
}

export interface RawPrice {
  id: string;
  store_id: string;
  price: number | string;
  original_price?: number | string | null;
  last_updated?: string | null;
  promo_text?: string | null;
  promo_price?: number | string | null;
  promo_min_qty?: number | null;
}

export interface PickedPrice {
  id: string;
  price: number;
  originalPrice?: number;
  store: string; // cadena
  storeName: string;
  store_id: string; // sucursal donde se muestra
  source_store_id: string; // tienda donde está guardado el precio
  distance?: number;
  address?: string;
  online: boolean;
  // Precio de esa sucursal (no el online de la cadena).
  local: boolean;
  // Promo por cantidad de esa sucursal.
  promo?: QtyPromo;
}

interface Source {
  chain: string;
  rank: number; // 0 local, 1 online
  branch: SourceStore;
}

export type PriceSources = Map<string, Source>;

// Tiendas cuyos precios se pueden mostrar, con la cadena y la sucursal donde se muestran.
export function priceSources(nearby: SourceStore[], online: SourceStore[]): PriceSources {
  const nearestByChain = new Map<string, SourceStore>();
  for (const s of nearby) {
    const chain = chainOf(s.name || "");
    const prev = nearestByChain.get(chain);
    if (!prev || (s.distance ?? Infinity) < (prev.distance ?? Infinity)) nearestByChain.set(chain, s);
  }
  const sources: PriceSources = new Map();
  for (const s of online) {
    const chain = chainOf(s.name || "");
    const branch = nearestByChain.get(chain);
    if (branch) sources.set(s.id, { chain, rank: 1, branch });
  }
  for (const s of nearby) {
    if (s.price_source === "online" || sources.has(s.id)) continue;
    sources.set(s.id, { chain: chainOf(s.name || ""), rank: 0, branch: s });
  }
  return sources;
}

// Un precio por cadena: primero el local, después el más cercano, después el más reciente.
export function pickPrices(rows: RawPrice[], sources: PriceSources): PickedPrice[] {
  const best = new Map<string, { src: Source; row: RawPrice }>();
  for (const row of rows) {
    const src = sources.get(row.store_id);
    if (!src || !(Number(row.price) > 0)) continue;
    const prev = best.get(src.chain);
    const better =
      !prev ||
      src.rank < prev.src.rank ||
      (src.rank === prev.src.rank &&
        ((src.branch.distance ?? Infinity) < (prev.src.branch.distance ?? Infinity) ||
          ((src.branch.distance ?? Infinity) === (prev.src.branch.distance ?? Infinity) &&
            (row.last_updated || "") > (prev.row.last_updated || ""))));
    if (better) best.set(src.chain, { src, row });
  }
  return [...best.values()]
    .map(({ src, row }) => {
      const price = Number(row.price);
      // El scraper a veces guarda el precio anterior multiplicado por 100 ($355.000 en una leche
      // de $3.550): sólo se muestra tachado si es mayor y como mucho el triple.
      const orig = row.original_price ? Number(row.original_price) : undefined;
      return {
        id: row.id,
        price,
        originalPrice: orig && orig > price && orig <= price * 3 ? orig : undefined,
        store: src.chain,
        storeName: src.chain,
        store_id: src.branch.id,
        source_store_id: row.store_id,
        distance: src.branch.distance,
        address: src.branch.address || undefined,
        online: isOnlineChain(src.chain),
        local: src.rank === 0,
        promo: qtyPromoFrom(row),
      };
    })
    .sort((a, b) => a.price - b.price);
}
