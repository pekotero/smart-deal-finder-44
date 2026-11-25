// Reglas comunes para decidir si un precio scrapeado es confiable.

// VTEX (Carrefour, Jumbo): los productos sin stock quedan publicados con precios viejos
// (ej. Pepsi 1.5 L a $165), así que sólo se toman los que tienen stock.
export const vtexAvailable = (offer: { AvailableQuantity?: number; IsAvailable?: boolean } | undefined) =>
  !!offer && (offer.AvailableQuantity ?? 0) > 0 && offer.IsAvailable !== false;

// Coto (Constructor.io): store_availability lista las sucursales con stock; vacía = sin stock
// en ninguna, y el precio suele ser viejo (ej. harina 1 kg a $195).
export const cotoAvailable = (data: { store_availability?: unknown } | undefined) =>
  !Array.isArray(data?.store_availability) || data!.store_availability.length > 0;

// Precio anterior (tachado): sólo si es mayor al actual y como mucho el triple. El ListPrice
// de Jumbo viene sin IVA y x100 (ej. $363.636 para una Pepsi de $4.400).
export const sanePreviousPrice = (price: number, previous: unknown) => {
  const prev = Number(previous);
  return prev > price && prev <= price * 3 ? prev : null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Precio nuevo sospechoso (ej. una gaseosa a $0,89): devuelve el motivo, o null si es creíble.
// previous: el precio que ya estaba guardado en esa cadena. others: los de las otras cadenas.
export function suspiciousPrice(price: number, previous: number | null, others: number[]): string | null {
  if (price < 50) return `precio de $${price}`;
  if (previous && (price < previous / 3 || price > previous * 3)) return `pasó de $${previous} a $${price}`;
  if (others.length >= 2) {
    const m = median(others);
    if (price < m / 2.5 || price > m * 2.5) return `$${price} contra $${m} en otras cadenas`;
  }
  return null;
}
