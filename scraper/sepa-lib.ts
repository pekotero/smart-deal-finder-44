// Funciones puras para los datos SEPA (Precios Claros): sin red ni base, así se pueden testear.
import { sizeFromName } from "../src/lib/size";

export interface Zone {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

// Zonas donde se cargan precios por sucursal. El centro es un punto público de referencia.
export const ZONES: Zone[] = [
  { name: "Zona Norte GBA", lat: -34.49, lng: -58.62, radiusKm: 15 },
  // Centro de Rosario: la app lo usa cuando no tiene la ubicación del usuario.
  { name: "Rosario", lat: -32.9468, lng: -60.6393, radiusKm: 15 },
  { name: "CABA", lat: -34.6037, lng: -58.3816, radiusKm: 10 },
];

// Banderas que se cargan (id_comercio-id_bandera) y con qué nombre: el nombre tiene que dar la
// cadena correcta en chainOf. Quedan afuera mayoristas, farmacias y estaciones de servicio.
export const BANNERS: Record<string, string> = {
  "9-1": "Vea",
  "9-2": "Disco",
  "9-3": "Jumbo",
  "15-1": "Dia",
  "11-1": "ChangoMás",
  "11-2": "ChangoMás",
  "11-3": "ChangoMás",
  "11-4": "ChangoMás",
  "11-5": "ChangoMás",
  "10-1": "Carrefour Hiper",
  "10-2": "Carrefour Market",
  "10-3": "Carrefour Express",
  "12-1": "Coto",
  "2-1": "La Anónima",
  "13-1": "Cooperativa Obrera",
};

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// Texto de un CSV de SEPA: algunas empresas lo publican en UTF-8 y otras en Latin-1.
export function decodeCsv(buf: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("latin1").decode(buf);
  }
  return text.replace(/^﻿/, "");
}

// Filas de un CSV separado por "|" (descarta las que tienen otra cantidad de columnas).
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  const head = lines[0].split("|").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split("|");
    if (f.length !== head.length) continue;
    rows.push(Object.fromEntries(head.map((h, i) => [h, f[i].trim()])));
  }
  return rows;
}

// EAN sin ceros adelante, para cruzar con los productos que ya hay. null si no es un EAN.
export function normEan(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{8,14}$/.test(s)) return null;
  const n = s.replace(/^0+/, "");
  return n.length >= 7 ? n : null;
}

const LOWER_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "x", "con", "sin", "en", "a", "al", "p/", "c/", "s/"]);
const UNITS = new Set(["g", "gr", "grs", "grm", "kg", "kgs", "ml", "cc", "l", "lt", "lts", "un", "uni", "u", "cm", "mts", "m"]);

// "LECHE ENTERA LA SERENISIMA X 1 LT" -> "Leche Entera la Serenisima x 1 lt".
export function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) => {
      if (i > 0 && (LOWER_WORDS.has(w) || UNITS.has(w.replace(/\.$/, "")))) return w;
      if (/^\d/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

// Códigos de envase que algunas cadenas meten antes del tamaño ("CJA 20 GRM", "BOT 125 ML").
const PACK_CODE = /\b(CJA|PAQ|BOT|POT|POM|PAS|BOL|LAT|SOB|BLI|DOY|FCO|PVC|BAR|TAB|ENV|BID|TET|VAS|PET|SAC|FRA|TUB|ROL|EST|PMO|SCH)\.?\s+(?=\d)/g;
// Sufijo de Cencosud: "... PAQ-20-gr." (envase, cantidad y unidad).
const CENCOSUD_SUFFIX = /\s+[A-Z]{2,4}-([\d.,]+)-([a-z]+)\.?$/;

// Nombre legible a partir de la descripción de una cadena.
export function cleanDescription(company: string, desc: string): string {
  let d = desc.replace(/\s+/g, " ").trim();
  if (!d) return "";
  const suffix = d.match(CENCOSUD_SUFFIX);
  if (suffix) {
    d = d.replace(CENCOSUD_SUFFIX, "").replace(/[\s.]+$/, "");
    if (!sizeFromName(d)) d += ` x ${suffix[1]} ${suffix[2]}`;
  }
  if (/[a-záéíóúñ]/.test(d)) return d.charAt(0).toUpperCase() + d.slice(1);
  return titleCase(d.replace(PACK_CODE, ""));
}

// Qué cadena describe mejor sus productos: Coto los escribe completos, Carrefour los corta en
// 50 letras y Día en 20.
const DESC_PRIORITY = ["12", "11", "9", "13", "2", "10", "15"];

// La mejor descripción de un EAN entre las de cada empresa ({ id_comercio: descripción }).
export function pickDescription(byCompany: Record<string, string>): string {
  const companies = Object.keys(byCompany).sort((a, b) => {
    const ra = DESC_PRIORITY.indexOf(a);
    const rb = DESC_PRIORITY.indexOf(b);
    return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
  });
  for (const c of companies) {
    const d = cleanDescription(c, byCompany[c]);
    if (d.length >= 6) return d;
  }
  return companies.length ? cleanDescription(companies[0], byCompany[companies[0]]) : "";
}

// Categorías de la app (las nuevas se crean solas con fill-categories.ts).
export const CATEGORY_ICONS: Record<string, string> = {
  Almacén: "🛒",
  Bebidas: "🥤",
  Lácteos: "🥛",
  Limpieza: "🧹",
  Higiene: "🧴",
  Panadería: "🍞",
  "Carnes y Fiambres": "🥩",
  "Frutas y Verduras": "🥬",
  Congelados: "🧊",
  Bebés: "🍼",
  Mascotas: "🐾",
  "Hogar y más": "🏠",
};

// Categoría por palabras del nombre. null si no se reconoce. El orden importa: primero las más
// específicas ("alimento para perro" antes que Almacén, "helado" antes que Lácteos).
const CATEGORY_WORDS: [string, RegExp][] = [
  ["Mascotas", /\b(perros?|gatos?|mascotas?|pet'?s class|pet shop|piedras sanitarias|arena sanitaria|dog chow|cat chow|pedigree|whiskas|excellent|eukanuba|royal canin|old prince|sieger|vital can|pro plan)\b/i],
  ["Bebés", /\b(pa[nñ]al(es)?|beb[eé]s?|baby|mamadera|chupete|toallitas h[uú]medas|leche (de f[oó]rmula|infantil)|nutrilon|nan optipro|vital ?3|sancor bebe|huggies|pampers|babysec|estrella baby|algabo baby)\b/i],
  ["Congelados", /\b(congelad[oa]s?|helados?|hielo|ice cream|bocaditos de|patitas de pollo|nuggets|papas (pre ?fritas|congeladas)|vegetales congelados|hamburguesas? congelad)\b/i],
  ["Carnes y Fiambres", /\b(carne|nalga|cuadril|vac[ií]o|asado|matambre|bife|peceto|osobuco|carr[eé]|bondiola|pollo|pechuga|suprema|muslo|alitas|chorizo|morcilla|salchich[oó]n|salchichas?|milanesas?|medall[oó]n(es)?|hamburguesas?|jam[oó]n|paleta cocida|salame|salamín|mortadela|fiambre|bondiola|panceta|lomo|pescado|merluza|at[uú]n fresco|salm[oó]n|langostinos|mondongo|carne picada)\b/i],
  ["Higiene", /\b(shampoo|champ[uú]|acondicionador|desmaquill\w*|antitransp\w*|crema (de manos|p\/ ?manos|facial|corporal|para peinar|dental)|protector solar|jab[oó]n de tocador|desodorante(?! de ambiente)|antitranspirante|pasta dental|cepillo dental|enjuague bucal|toallas femeninas|protectores diarios|tampones|papel higi[eé]nico|afeitar|maquinita|algod[oó]n|hisopos|coloraci[oó]n|tintura|perfume|colonia|maquillaje|esmalte|preservativos|curitas|ap[oó]sitos|alcohol en gel|alcohol et[ií]lico)\b/i],
  ["Limpieza", /\b(detergente|lavandina|lavavajilla|jab[oó]n (en polvo|l[ií]quido para ropa|para ropa)|suavizante|limpiador|desengrasante|limpia ?vidrios|desodorante de ambiente|aromatizante|insecticida|esponja|trapo|rejilla|bolsas de residuo|bolsas para residuo|cera para pisos|quitamanchas|cloro|escobill[oó]n|escoba|secador de piso|lampazo|pa[nñ]o (multiuso|de limpieza)|guantes de limpieza|fregona|desinfectante|repelente)\b/i],
  ["Lácteos", /\b(leche|yogur|yoghurt|queso|manteca|crema de leche|dulce de leche|postre l[aá]cteo|ricota|leche cultivada|mozzarella|muzzarella|reggianito|cremoso)\b/i],
  ["Bebidas", /\b(gaseosa|agua (mineral|saborizada|con gas|sin gas|de mesa)|soda|jugo|cerveza|vino|fernet|aperitivo|bebida|energizante|isot[oó]nica|sidra|espumante|champa[nñ]a|whisky|vodka|gin|licor|ron|tequila|vermouth|malbec|cabernet|chardonnay)\b/i],
  ["Frutas y Verduras", /\b(banana|manzanas?|naranjas?|mandarinas?|limones|lim[oó]n x kg|peras?|uvas?|frutillas?|ar[aá]ndanos?|kiwi|anan[aá] fresco|sand[ií]a|mel[oó]n|duraznos?|ciruelas?|palta|tomates? (perita|redondo|cherry)|lechuga|r[uú]cula|acelga|espinaca|zanahorias?|cebollas?|zapallos?|zapallitos?|calabaza|batata|boniato|papa (blanca|negra)|papas? x kg|morr[oó]n|pepino|berenjena|br[oó]coli|coliflor|repollo|choclo fresco|ajo|jengibre|hongos|champi[nñ]ones|verdura|fruta fresca)\b/i],
  ["Panadería", /\b(pan (lactal|de molde|rallado|dulce|blanco|integral|de pancho|de hamburguesa|de viena)|budin|bud[ií]n|magdalenas|prepizza|tostadas|grisines|tapas para empanadas|tapas de empanadas|facturas|medialunas|bizcochos|pan x kg|panettone)\b/i],
  ["Almacén", /\b(aceite|arroz|fideos|harina|az[uú]car|yerba|caf[eé]|t[eé] |mate cocido|galletitas|galletas|mermelada|at[uú]n|arvejas|choclo|tomate|pur[eé]|salsa|mayonesa|ketchup|mostaza|vinagre|aceto|sal fina|sal gruesa|polenta|lentejas|porotos|garbanzos|cacao|chocolate|caramelos|alfajor|cereal|avena|granola|snack|papas fritas|chips|man[ií]|aceitunas|sopa|caldo|condimento|especias|or[eé]gano|pimienta|edulcorante|endulzante|gelatina|flan|bizcochuelo|premezcla|leche en polvo|conserva|miel|ravioles|[nñ]oquis|tapas de|pastas|gomitas|chicles?|turr[oó]n|oblea|barra de cereal|pizza|huevos?)\b/i],
  ["Hogar y más", /\b(plato|vaso|copa|bowl|taza|mug|jarro|jarra|cubiertos?|cuchara|tenedor|cuchillo|sart[eé]n|cacerola|olla|bifera|fuente|molde|tupper|herm[eé]tico|frasco|tarro|termo|botella t[eé]rmica|toalla|toall[oó]n|s[aá]bana|frazada|acolchado|almohad[oó]n|almohada|mantel|repasador|cortina|alfombra|vela|sahumerio|difusor|maceta|silla|mesa|l[aá]mpara|led|foco|pilas?|cable|alargue|adorno|arbol de navidad|guirnalda|globo|cotill[oó]n|juguete|mu[nñ]eca|peluche|pelota|juego de|rompecabezas|cuaderno|l[aá]piz|lapicera|marcador|remera|camisa|pantal[oó]n|jean|buzo|campera|medias|boxer|bombacha|corpi[nñ]o|pijama|sandalia|ojota|zapatilla|bota|mochila|valija|bolso|bandolera|cartera|organizador|canasto|cesto|perchas?|estante|ventilador|estufa|pava|tostadora|licuadora|batidora|microondas|heladera|televisor|smart tv|auriculares|parlante|celular|cargador|herramienta|destornillador|martillo|taladro|pala|manguera|neum[aá]tico|set de|kit de)\b/i],
];

export function guessCategory(name: string): string | null {
  for (const [cat, re] of CATEGORY_WORDS) if (re.test(name)) return cat;
  return null;
}

// Categoría a partir de las categorías VTEX de la cadena ("/Frescos/Lácteos/Yogures/").
const VTEX_RULES: [string, RegExp][] = [
  ["Mascotas", /mascota/i],
  ["Bebés", /beb[eé]|pa[nñ]al|maternidad/i],
  ["Congelados", /congelad|helado/i],
  ["Carnes y Fiambres", /carne|carnicer|fiambre|pescad|pollo|embutido|granja/i],
  ["Frutas y Verduras", /fruta|verdura|verduler/i],
  ["Lácteos", /l[aá]cteo|leche|yogur|queso|manteca|crema/i],
  ["Panadería", /panader|pan |pan$|budin|facturas/i],
  ["Bebidas", /bebida|vino|cerveza|gaseosa|agua|jugo|aperitivo|espumante|licor/i],
  ["Higiene", /perfumer|farmacia|higiene|belleza|cuidado personal|cuidado capilar|cuidado oral/i],
  ["Limpieza", /limpieza|lavado|desodorante de ambiente|insecticida/i],
  ["Almacén", /almac[eé]n|desayuno|merienda|golosina|snack|kiosco|conserva|aceite|pasta|arroz|harina|infusion|caf[eé]|yerba|frescos|diet[eé]tica|sin tacc|reposter/i],
  ["Hogar y más", /hogar|bazar|electro|tecno|deporte|ocio|aire libre|indumentaria|calzado|ropa|jugueter|librer|automotor|festividad|navidad|jard[ií]n|ferreter|textil|muebles|bebés y niños/i],
];

export function categoryFromVtex(paths: string[]): string | null {
  // De la más específica (más larga) a la más general.
  const sorted = [...paths].sort((a, b) => b.length - a.length);
  for (const p of sorted) for (const [cat, re] of VTEX_RULES) if (re.test(p)) return cat;
  return null;
}

export interface Branch {
  key: string; // comercio-bandera-sucursal
  banner: string; // comercio-bandera
  group: string; // se elige una sucursal por grupo (las tres banderas de ChangoMás son una)
  lat: number;
  lng: number;
  address: string;
}

// La sucursal más cercana al centro de cada zona, por grupo, dentro del radio.
export function nearestBranches(branches: Branch[], zones: Zone[]) {
  const chosen = new Map<string, Branch & { zone: string; km: number }>();
  for (const z of zones) {
    const best = new Map<string, Branch & { km: number }>();
    for (const b of branches) {
      const km = distanceKm(z.lat, z.lng, b.lat, b.lng);
      if (km > z.radiusKm) continue;
      const prev = best.get(b.group);
      if (!prev || km < prev.km) best.set(b.group, { ...b, km });
    }
    for (const b of best.values()) if (!chosen.has(b.key)) chosen.set(b.key, { ...b, zone: z.name });
  }
  return [...chosen.values()];
}

// ---------- promos ----------
export interface SepaPrice {
  price: number; // lo que se paga por una unidad (con la rebaja directa, si hay)
  original?: number; // precio de lista, si hay rebaja directa
  // Promo por cantidad: precio por unidad llevando minQty o más.
  promo?: { text: string; unitPrice: number; minQty: number };
}

const num = (s: string | undefined) => {
  const n = parseFloat(String(s ?? "").replace(",", "."));
  return n > 0 ? n : 0;
};

// Lo que dice la promo, sin el "NN% de descuento." ni la vigencia: "2DO AL 70% SIDRAS Y".
const promoBody = (legend: string) =>
  legend
    .replace(/^\s*\d+([.,]\d+)?% de descuento\.\s*/i, "")
    .replace(/\s*-\s*Vigencia:.*$/i, "")
    .trim();

// Precio de una fila de productos.csv con sus dos promos. promo1 es una rebaja por unidad
// (Carrefour "Promo A", Día "Precio Promocional"); en promo2 Día pone rebajas directas ("25% SEDAL")
// y promos por cantidad ("2DO AL 70%", "3X2", "2X$1000").
export function parseSepaPrice(list: string, p1: string, l1: string, p2: string, l2: string): SepaPrice | null {
  const lista = num(list);
  if (!lista) return null;
  const out: SepaPrice = { price: lista };
  const promo1 = num(p1);
  if (promo1 && promo1 < lista && promo1 >= lista * 0.2 && (l1 || "").trim()) {
    out.price = promo1;
    out.original = lista;
  }
  const promo2 = num(p2);
  const body = promoBody(l2 || "");
  if (promo2 && promo2 < lista && promo2 >= lista * 0.2 && body) {
    let m: RegExpMatchArray | null;
    let multi: { text: string; minQty: number } | null = null;
    if ((m = body.match(/\b(\d)\s*(?:DO|DA|°|º)\s+AL\s+(\d+)\s*%/i))) multi = { text: `${m[1]}° al ${m[2]}%`, minQty: Number(m[1]) };
    else if ((m = body.match(/\b(\d)\s*X\s*\$\s*([\d.]+)/i)))
      multi = { text: `${m[1]} x $${Number(m[2].replace(/\./g, "")).toLocaleString("es-AR")}`, minQty: Number(m[1]) };
    else if ((m = body.match(/\b(\d)\s*X\s*(\d)\b/i)) && Number(m[1]) > Number(m[2])) multi = { text: `${m[1]}x${m[2]}`, minQty: Number(m[1]) };
    if (multi && multi.minQty >= 2) {
      if (promo2 < out.price) out.promo = { text: multi.text, unitPrice: promo2, minQty: multi.minQty };
    } else if (/^\d+\s*%/.test(body) && promo2 < out.price) {
      // Rebaja directa ("25% SEDAL").
      out.price = promo2;
      out.original = lista;
    }
  }
  return out;
}
