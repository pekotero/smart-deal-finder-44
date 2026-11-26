// Filtros de la lista de productos.

export interface PriceFilters {
  min?: number | null;
  max?: number | null;
  onlyDiscount?: boolean;
}

interface Filterable {
  bestPrice?: number;
  prices: { price: number; originalPrice?: number; promo?: unknown }[];
}

// Tiene descuento si algún precio de los que se muestran está rebajado o tiene promo por cantidad.
export const hasDiscount = (p: Filterable) => p.prices.some((pr) => (pr.originalPrice && pr.originalPrice > pr.price) || !!pr.promo);

export function applyPriceFilters<T extends Filterable>(list: T[], f: PriceFilters): T[] {
  return list.filter((p) => {
    const best = p.bestPrice ?? p.prices[0]?.price;
    if (f.min && !(best >= f.min)) return false;
    if (f.max && !(best <= f.max)) return false;
    if (f.onlyDiscount && !hasDiscount(p)) return false;
    return true;
  });
}

// Palabras a excluir, separadas por espacios o comas.
export const excludedWords = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((w) => w.replace(/^-+/, "").trim())
    .filter(Boolean);

// Búsqueda para la base: las palabras a excluir van con "-" adelante ("leche -dulce").
export function searchWithExclusions(query: string, exclude: string) {
  return [query.trim(), ...excludedWords(exclude).map((w) => `-${w}`)].filter(Boolean).join(" ");
}

export const activeFilterCount = (f: PriceFilters & { exclude?: string }) =>
  Number(!!f.min) + Number(!!f.max) + Number(!!f.onlyDiscount) + Number(excludedWords(f.exclude || "").length > 0);
