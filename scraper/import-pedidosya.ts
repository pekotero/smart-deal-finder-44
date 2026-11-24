// Carga en Supabase los precios de PedidosYa leídos a mano desde el navegador (scraper/pedidosya/*.json).
// PedidosYa bloquea el acceso automático, así que no hay scraper diario: estos precios son una foto
// del momento en que se leyeron y se actualizan volviendo a leerlos.
//
// Uso: npx tsx import-pedidosya.ts          (prueba: muestra cómo cruza los productos)
//      npx tsx import-pedidosya.ts --write  (guarda tiendas, productos y precios)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sizeFromName, sizeKey } from '../src/lib/size';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const WRITE = process.argv.includes('--write');

// Cada archivo va a una tienda propia. El nombre empieza con "PedidosYa" para que la app la trate
// como cadena aparte (los precios de PedidosYa no son los de la góndola ni los de la web de la cadena).
// Coordenadas: las de la sucursal de la cadena en la base o, para el Market (PedidosYa no publica
// dónde está su depósito), el centro de la localidad.
const SOURCES = [
  {
    file: 'market-pacheco.json',
    store: { name: 'PedidosYa Market (General Pacheco)', chain: 'PedidosYa Market', address: 'General Pacheco, Tigre', latitude: -34.45, longitude: -58.65 },
  },
  {
    file: 'carrefour-don-torcuato.json',
    store: { name: 'PedidosYa · Carrefour Hiper (Don Torcuato)', chain: 'Carrefour (PedidosYa)', address: 'Avenida Ángel Torcuato de Alvear 1960, Don Torcuato', latitude: -34.4914499, longitude: -58.6276814 },
  },
  {
    file: 'dia-don-torcuato.json',
    store: { name: 'PedidosYa · Dia (Don Torcuato)', chain: 'Día (PedidosYa)', address: 'Avenida Ángel Torcuato de Alvear 2235, Don Torcuato', latitude: -34.4905826, longitude: -58.6240582 },
  },
];

type Item = [name: string, price: number, prev: number | null, img: string];
interface Dump { store: string; imgPrefix: string; items: Item[] }

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'x', 'para', 'a', 'al', 'sabor', 'tipo']);
const UNIT_RE = /\b\d+(?:[.,]\d+)?\s*(?:kgm|kgs?|kilos?|grs?|gramos|grm|gr|g|mls?|cc|cm3|cmq|lts?|ltr|litros?|l)\b/g;

function tokens(name: string): Set<string> {
  const t = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(UNIT_RE, ' ')
    .replace(/[^a-z0-9.%\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/\.$/, ''))
    .filter((w) => w && !STOP.has(w));
  return new Set(t);
}

// Palabras que describen el envase o la presentación y no cambian el producto.
// "sachet" no: un sachet y una botella de leche no cuestan lo mismo. Las unidades ("x 6 un") tampoco.
const FILLER = new Set(['botella', 'tetra', 'pack', 'brick', 'ttb', 'uat', 'uht', 'larga', 'vida', 'clasica', 'clasico',
  'fresca', 'fresco', 'doypack', 'bidon', 'paquete', 'lata', 'pote', 'frasco', 'caja', 'original', 'tradicional', 'gr', 'grs',
  'lt', 'lts', 'envase', 'descartable', 'retornable', 'mate', 'gaseosa', 'bolsa', 'estuche', 'pet', 'paq',
  'kgm', 'dp', 'regular']);

// Diferencias que importan: palabras de un nombre que no están en el otro, sin contar el relleno.
// Una marca distinta suma dos (una de cada lado), así que nunca cruza.
function differences(a: Set<string>, b: Set<string>) {
  let diff = 0, inter = 0;
  for (const w of a) if (b.has(w)) inter++; else if (!FILLER.has(w)) diff++;
  for (const w of b) if (!a.has(w) && !FILLER.has(w)) diff++;
  return { diff, inter, jaccard: inter / (a.size + b.size - inter) };
}

function categoryFor(name: string, cat: Record<string, string>): string | null {
  const l = name.toLowerCase();
  if (/leche|yogur|queso|crema|manteca/.test(l)) return cat['lácteos'] || cat['lacteos'] || null;
  if (/gaseosa|coca|pepsi|sprite|agua|cerveza|vino|jugo/.test(l)) return cat['bebidas'] || null;
  if (/detergente|lavandina|jab[oó]n|limpia|desinfect|papel higi/.test(l)) return cat['limpieza'] || null;
  return cat['almacén'] || cat['almacen'] || null;
}

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  const products = await fetchAll<{ id: string; name: string }>('products', 'id, name');
  const { data: cats } = await supabase.from('categories').select('id, name');
  const catMap: Record<string, string> = {};
  cats?.forEach((c) => (catMap[c.name.toLowerCase()] = c.id));

  // Índice por tamaño: sólo se cruzan productos del mismo tamaño ("1 L" con "1000 ml").
  const bySize = new Map<string, { id: string; name: string; tokens: Set<string> }[]>();
  for (const p of products) {
    const key = sizeKey(sizeFromName(p.name));
    if (!key) continue;
    if (!bySize.has(key)) bySize.set(key, []);
    bySize.get(key)!.push({ id: p.id, name: p.name, tokens: tokens(p.name) });
  }
  console.log(`${products.length} productos en la base\n`);

  for (const src of SOURCES) {
    const dump: Dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'pedidosya', src.file), 'utf8'));
    let matched = 0;
    const samples: string[] = [];
    const rows: { productId: string | null; item: Item; key: string; tk: Set<string> }[] = [];

    for (const item of dump.items) {
      const [name] = item;
      const key = sizeKey(sizeFromName(name));
      const tk = tokens(name);
      let best: { id: string; name: string; diff: number; j: number } | null = null;
      let ties = 0;
      for (const c of (key && bySize.get(key)) || []) {
        const { diff, inter, jaccard } = differences(tk, c.tokens);
        // Sin diferencias reales: con una sola ya se cuelan "con palo"/"sin palo" o "x3"/x1.
        if (diff > 0 || inter < 2) continue;
        if (!best || diff < best.diff || (diff === best.diff && jaccard > best.j)) { best = { id: c.id, name: c.name, diff, j: jaccard }; ties = 0; }
        else if (diff === best.diff && jaccard === best.j) ties++;
      }
      const ok = !!best && ties === 0;
      if (ok) {
        matched++;
        if (samples.length < 40 && best!.j < 0.75) samples.push(`  ${best!.diff}  ${name}  →  ${best!.name}`);
      }
      const row = { productId: ok ? best!.id : null, item, key, tk };
      rows.push(row);
    }

    console.log(`== ${dump.store}: ${dump.items.length} productos, ${matched} cruzados con productos existentes`);
    console.log(samples.join('\n'));
    // Los productos nuevos entran al índice para cruzarse con las otras tiendas de PedidosYa.
    const addToIndex = (r: (typeof rows)[number]) => {
      if (!r.key || !r.productId) return;
      if (!bySize.has(r.key)) bySize.set(r.key, []);
      bySize.get(r.key)!.push({ id: r.productId, name: r.item[0], tokens: r.tk });
    };
    if (!WRITE) {
      rows.filter((r) => !r.productId).forEach((r, i) => { r.productId = `nuevo-${src.file}-${i}`; addToIndex(r); });
      continue;
    }

    // Tienda
    let { data: store } = await supabase.from('stores').select('id').eq('name', src.store.name).maybeSingle();
    if (!store) {
      const { data, error } = await supabase.from('stores').insert({ ...src.store, is_open: true }).select('id').single();
      if (error) throw error;
      store = data;
    }

    // Productos nuevos
    for (const r of rows) {
      if (r.productId) continue;
      const [name, , , img] = r.item;
      const { data, error } = await supabase
        .from('products')
        .insert({
          name,
          brand: name.split(' ')[0],
          image_url: img ? (img.startsWith('http') ? img : dump.imgPrefix + img) : null,
          category_id: categoryFor(name, catMap),
        })
        .select('id')
        .single();
      if (error) { console.warn('  no se pudo crear', name, error.message); continue; }
      r.productId = data.id;
      addToIndex(r);
    }

    // Precios: la foto nueva reemplaza la anterior de esa tienda.
    await supabase.from('prices').delete().eq('store_id', store!.id);
    const priceRows = [...new Map(rows.filter((r) => r.productId).map((r) => [r.productId, r])).values()].map((r) => ({
      product_id: r.productId!,
      store_id: store!.id,
      price: r.item[1],
      original_price: r.item[2] && r.item[2] > r.item[1] && r.item[2] <= r.item[1] * 3 ? r.item[2] : null,
    }));
    for (let i = 0; i < priceRows.length; i += 500) {
      const { error } = await supabase.from('prices').insert(priceRows.slice(i, i + 500));
      if (error) throw error;
    }
    console.log(`  guardados ${priceRows.length} precios en "${src.store.name}"\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
