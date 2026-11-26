// Cadena de una tienda a partir de su nombre. Pura (sin React ni Supabase): la usa también el scraper.

// Las cadenas nuevas se reconocen sólo al principio del nombre (con "Supermercado" opcional),
// para no confundir "Diarco", "Buen Día", "El Chango" o "Super Vea" con Día, ChangoMás o Vea.
const CHAIN_PATTERNS: [RegExp, string][] = [
  [/^(supermercados? )?disco\b/i, "Disco"],
  [/^(supermercados? )?vea\b(?! d[ií]a)/i, "Vea"],
  [/^(supermercados? )?d[ií]a\b(?! de\b| a d)/i, "Día"],
  [/^(supermercados? |hiper |walmart (hiper )?)?chango ?m[aáâà]s\b/i, "ChangoMás"],
];

// Tiendas de PedidosYa (cargadas desde la app): son cadenas aparte, con los precios de la app.
// Van antes que el resto porque "PedidosYa · Carrefour" también dice "carrefour".
const PEDIDOSYA_RE = /^pedidosya\b/i;

// Tiendas online: se compran desde una app con envío (sus precios no son los de la góndola).
export const isOnlineChain = (chain: string) => /pedidosya/i.test(chain);

export const chainOf = (storeName: string) => {
  const lower = storeName.toLowerCase();
  if (PEDIDOSYA_RE.test(storeName.trim())) {
    if (lower.includes("carrefour")) return "Carrefour (PedidosYa)";
    if (/\bd[ií]a\b/i.test(storeName)) return "Día (PedidosYa)";
    return "PedidosYa Market";
  }
  if (lower.includes("coto")) return "Coto";
  if (lower.includes("carrefour")) return "Carrefour";
  if (lower.includes("jumbo")) return "Jumbo";
  if (lower.includes("gallega")) return "La Gallega";
  if (lower.includes("reina")) return "La Reina";
  if (/\bla an[oó]nima\b/.test(lower)) return "La Anónima";
  if (lower.includes("cooperativa obrera")) return "Cooperativa Obrera";
  const name = storeName.trim();
  for (const [re, chain] of CHAIN_PATTERNS) if (re.test(name)) return chain;
  return storeName;
};
