// Tamaño de un producto leído de su nombre ("Aceite 1.5 Lt", "Jabón X 75 grs", "Pack X 6 Un").
// Misma lógica que el buscador de precios: gr/g -> kg y ml/cc -> lt, así "1000 ml" y "1 L"
// caen en el mismo tamaño.

export interface Size {
  qty: number;
  unit: "kg" | "lt" | "un";
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const SIZE_RE = new RegExp(
  // (?![a-wyz]): después de la unidad no puede seguir otra letra, salvo "x" ("500mlx1").
  NUM + String.raw`\s*(kgm|kgs?|kilos?|grs?|gramos|grm|gr\.?|g|mls?|cc|cm3|cmq|lts?|ltr|litros?|l|un(?:idades|\.)?|u)(?![a-wyz])`,
  "gi",
);

export function sizeFromName(name: string): Size | null {
  let last: Size | null = null;
  for (const m of (name || "").matchAll(SIZE_RE)) {
    const qty = parseFloat(m[1].replace(",", "."));
    const u = m[2].toLowerCase().replace(".", "");
    if (!qty) continue;
    if (u.startsWith("k")) last = { qty, unit: "kg" };
    else if (u.startsWith("g")) last = { qty: qty / 1000, unit: "kg" };
    else if (u.startsWith("ml") || u === "cc" || u === "cm3" || u === "cmq") last = { qty: qty / 1000, unit: "lt" };
    else if (u.startsWith("l")) last = { qty, unit: "lt" };
    else if (u.startsWith("u")) last = { qty, unit: "un" };
    // Si el nombre trae peso y unidades ("Pack x 6 un 500 ml"), se queda con el peso/volumen.
    if (last && last.unit !== "un") return last;
  }
  // "Queso cremoso x kg": se vende por kilo.
  if (!last && /\bx\s*kg\b/i.test(name || "")) return { qty: 1, unit: "kg" };
  return last;
}

// Clave para agrupar: "1.5 lt", "0.5 kg", "6 un".
export const sizeKey = (s: Size | null) => (s ? `${+s.qty.toFixed(3)} ${s.unit}` : "");

// Texto para mostrar: "1,5 lt", "500 ml", "75 g", "6 unidades".
export function sizeLabel(key: string) {
  const [q, u] = key.split(" ");
  const n = +q;
  if (u === "kg" && n < 1) return `${Math.round(n * 1000)} g`;
  if (u === "lt" && n < 1) return `${Math.round(n * 1000)} ml`;
  if (u === "un") return `${n} ${n === 1 ? "unidad" : "unidades"}`;
  return `${String(n).replace(".", ",")} ${u}`;
}

// Precio por litro, kilo o unidad, para comparar tamaños distintos.
export function unitPrice(price: number, size: Size | null) {
  if (!size || !(price > 0) || !(size.qty > 0)) return null;
  return { value: price / size.qty, unit: size.unit };
}

const UNIT_WORD = { lt: "litro", kg: "kilo", un: "unidad" } as const;

// "$3.244 x litro"
export function unitPriceLabel(u: { value: number; unit: Size["unit"] } | null) {
  if (!u) return "";
  return `$${Math.round(u.value).toLocaleString("es-AR")} x ${UNIT_WORD[u.unit]}`;
}

// Orden: primero por unidad (lt, kg, un) y después de menor a mayor.
const UNIT_ORDER = { lt: 0, kg: 1, un: 2 } as Record<string, number>;
export function compareSizeKeys(a: string, b: string) {
  const [qa, ua] = a.split(" ");
  const [qb, ub] = b.split(" ");
  return (UNIT_ORDER[ua] ?? 9) - (UNIT_ORDER[ub] ?? 9) || +qa - +qb;
}
