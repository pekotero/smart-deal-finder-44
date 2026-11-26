// Fotos para los productos que no tienen (los que crea SEPA llegan sin imagen): se buscan por
// código de barras en las tiendas online VTEX de las cadenas, con su API pública de catálogo.
// Los que no aparecen en ninguna quedan con image_url = '' para no volver a buscarlos cada día
// (con --retry se vuelven a buscar).
//
//   npx tsx fill-images.ts                 muestra cuántas encontraría (sin escribir)
//   npx tsx fill-images.ts --write         además las guarda
//   npx tsx fill-images.ts --limit 500     sólo los primeros 500 productos
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { normEan } from "./sepa-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const RETRY = args.includes("--retry");
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

// Cencosud (Jumbo, Disco, Vea) comparte catálogo: con Jumbo alcanza.
const HOSTS = ["www.carrefour.com.ar", "www.jumbo.com.ar", "diaonline.supermercadosdia.com.ar", "www.masonline.com.ar"];
const BATCH = 40; // EANs por consulta (varios fq del mismo campo se combinan con "o")
const PAUSE_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Imagen chica (300 px) en vez de la original.
export function smallImage(url: string) {
  return url.replace(/\/arquivos\/ids\/(\d+)(-\d+-\d+)?\//, "/arquivos/ids/$1-300-300/").replace(/^http:/, "https:");
}

interface VtexProduct {
  items?: { ean?: string; images?: { imageUrl: string }[] }[];
}

async function lookup(host: string, eans: string[]): Promise<Map<string, string>> {
  const fq = eans.map((e) => `fq=alternateIds_Ean:${e}`).join("&");
  const url = `https://${host}/api/catalog_system/pub/products/search?${fq}&_from=0&_to=49`;
  const found = new Map<string, string>();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (!res.ok) return found;
      const data = (await res.json()) as VtexProduct[];
      for (const p of data) {
        for (const item of p.items || []) {
          const ean = normEan(item.ean);
          const img = item.images?.[0]?.imageUrl;
          if (ean && img && !found.has(ean)) found.set(ean, smallImage(img));
        }
      }
      return found;
    } catch {
      await sleep(2000);
    }
  }
  return found;
}

async function missing() {
  const out: { id: string; ean: string }[] = [];
  for (let from = 0; out.length < LIMIT; from += 1000) {
    let q = db.from("products").select("id, ean").not("ean", "is", null).order("id").range(from, from + 999);
    q = RETRY ? q.or("image_url.is.null,image_url.eq.") : q.is("image_url", null);
    const { data, error } = await q;
    if (error) throw error;
    for (const r of data || []) {
      const ean = normEan(r.ean);
      if (ean) out.push({ id: r.id, ean });
    }
    if (!data || data.length < 1000) break;
  }
  return out.slice(0, LIMIT);
}

async function save(rows: { id: string; image_url: string }[]) {
  for (let i = 0; i < rows.length; i += 20) {
    await Promise.all(
      rows.slice(i, i + 20).map(async (r) => {
        const { error } = await db.from("products").update({ image_url: r.image_url }).eq("id", r.id);
        if (error) console.warn(`  ${r.id}: ${error.message}`);
      }),
    );
  }
}

async function main() {
  const todo = await missing();
  console.log(`${todo.length} productos sin foto`);
  let pending = todo;
  let total = 0;
  for (const host of HOSTS) {
    if (!pending.length) break;
    const t0 = Date.now();
    const found: { id: string; image_url: string }[] = [];
    const got = new Set<string>();
    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH);
      const imgs = await lookup(host, [...new Set(chunk.map((p) => p.ean))]);
      for (const p of chunk) {
        const img = imgs.get(p.ean);
        if (img) {
          found.push({ id: p.id, image_url: img });
          got.add(p.id);
        }
      }
      // Se guarda de a poco, así un corte no pierde lo encontrado.
      if (WRITE && found.length >= 400) await save(found.splice(0));
      await sleep(PAUSE_MS);
    }
    if (WRITE) await save(found);
    total += got.size;
    const before = pending.length;
    // Lo que quedó sin foto pasa a la cadena siguiente.
    pending = pending.filter((p) => !got.has(p.id));
    console.log(`${host}: ${before - pending.length} fotos (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  if (WRITE && pending.length && !RETRY) {
    // No aparecieron en ninguna tienda: se marcan para no buscarlos de nuevo cada día.
    await save(pending.map((p) => ({ id: p.id, image_url: "" })));
  }
  console.log(`${total} fotos encontradas; ${pending.length} sin foto${WRITE ? "" : " (modo prueba, no se guardó nada)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
