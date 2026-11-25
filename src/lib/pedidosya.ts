// Tiendas de PedidosYa con precios cargados. PedidosYa no tiene una forma pública de que otra app
// le cargue el carrito, pero su web acepta "?search=" para abrir la tienda buscando un producto:
// el carrito de la app arma un link por producto y el usuario lo agrega allá.
export const PEDIDOSYA_STORES: Record<string, string> = {
  "PedidosYa Market": "https://www.pedidosya.com.ar/restaurantes/tigre/pedidosya-market-pacheco-f9223331-0d9a-4e3a-b457-ea3302ca06fe-menu",
  "Carrefour (PedidosYa)": "https://www.pedidosya.com.ar/restaurantes/tigre/carrefour-hiper-don-torcuato-234-e50297dc-0a46-49f8-9e7b-42065bb98138-menu",
  "Día (PedidosYa)": "https://www.pedidosya.com.ar/restaurantes/tigre/dia-don-torcuato-101-b84a4704-de75-4e49-8f99-58c3b88143ab-menu",
};

const STOP = new Set(["de", "del", "la", "el", "los", "las", "en", "y", "x", "con", "para", "sabor", "tipo"]);
const SIZE_RE = /\b\d+(?:[.,]\d+)?\s*(?:kgm|kgs?|kilos?|grs?|gramos|gr|g|mls?|cc|cm3|lts?|ltr|litros?|l|un(?:idades)?|u)\b\.?/gi;

// Texto para buscar el producto dentro de la tienda: sin tamaño ni palabras vacías, y con pocas
// palabras, porque cada cadena escribe el nombre distinto ("Aceite de Girasol Cañuelas 900 Ml"
// en una, "Aceite Cañuelas Girasol 900 ml" en otra).
export function searchTerm(name: string, maxWords = 4) {
  return name
    .replace(SIZE_RE, " ")
    .replace(/[()[\]{}"'+,;:/|-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()) && !/^\d/.test(w))
    .slice(0, maxWords)
    .join(" ");
}

export const pedidosYaSearchUrl = (chain: string, productName: string) => {
  const base = PEDIDOSYA_STORES[chain];
  return base ? `${base}?search=${encodeURIComponent(searchTerm(productName))}` : null;
};
