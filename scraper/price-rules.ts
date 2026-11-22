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
