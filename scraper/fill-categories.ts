// Categorías para los productos que no tienen (los que crea SEPA y no se reconocen por el nombre).
// Primero la categoría que les da alguna cadena en su tienda online VTEX (por código de barras);
// si ninguna lo tiene, palabras del nombre. Crea las categorías nuevas que falten.
//
//   npx tsx fill-categories.ts                  muestra cuántos clasificaría (sin escribir)
//   npx tsx fill-categories.ts --write          además guarda
//   npx tsx fill-categories.ts --no-vtex        sólo por el nombre (rápido)
//   npx tsx fill-categories.ts --limit 500
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { CATEGORY_ICONS, categoryFromVtex, guessCategory, normEan } from "./sepa-lib";
import { BATCH, lookupEans, PAUSE_MS, sleep, VTEX_HOSTS } from "./vtex-lookup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const NO_VTEX = args.includes("--no-vtex");
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

async function categoryIds() {
  const { data, error } = await db.from("categories").select("id, name");
  if (error) throw error;
  const ids = new Map((data || []).map((c) => [c.name as string, c.id as string]));
  const missing = Object.keys(CATEGORY_ICONS).filter((n) => !ids.has(n));
  if (missing.length && WRITE) {
    const { data: created, error: e } = await db
      .from("categories")
      .insert(missing.map((name) => ({ name, icon: CATEGORY_ICONS[name] })))
      .select("id, name");
    if (e) throw e;
    for (const c of created || []) ids.set(c.name, c.id);
    console.log(`Categorías nuevas: ${missing.join(", ")}`);
  } else if (missing.length) console.log(`Se crearían las categorías: ${missing.join(", ")}`);
  return ids;
}

async function uncategorized() {
  const out: { id: string; name: string; ean: string | null }[] = [];
  for (let from = 0; out.length < LIMIT; from += 1000) {
    const { data, error } = await db.from("products").select("id, name, ean").is("category_id", null).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out.slice(0, LIMIT);
}

async function main() {
  const ids = await categoryIds();
  const todo = await uncategorized();
  console.log(`${todo.length} productos sin categoría`);
  const result = new Map<string, string>(); // product id -> categoría

  if (!NO_VTEX) {
    let pending = todo.map((p) => ({ ...p, e: normEan(p.ean) })).filter((p) => p.e);
    for (const host of VTEX_HOSTS) {
      if (!pending.length) break;
      const t0 = Date.now();
      let got = 0;
      for (let i = 0; i < pending.length; i += BATCH) {
        const chunk = pending.slice(i, i + BATCH);
        const info = await lookupEans(host, [...new Set(chunk.map((p) => p.e!))]);
        for (const p of chunk) {
          const cat = categoryFromVtex(info.get(p.e!)?.categories || []);
          if (cat) {
            result.set(p.id, cat);
            got++;
          }
        }
        await sleep(PAUSE_MS);
      }
      pending = pending.filter((p) => !result.has(p.id));
      console.log(`${host}: ${got} (${Math.round((Date.now() - t0) / 1000)} s)`);
    }
  }
  let byName = 0;
  for (const p of todo) {
    if (result.has(p.id)) continue;
    const cat = guessCategory(p.name);
    if (cat) {
      result.set(p.id, cat);
      byName++;
    }
  }

  const counts = new Map<string, number>();
  for (const c of result.values()) counts.set(c, (counts.get(c) || 0) + 1);
  console.log(`Por el nombre: ${byName}. Total: ${result.size} de ${todo.length}`);
  console.log([...counts].sort((a, b) => b[1] - a[1]).map(([c, n]) => `  ${c}: ${n}`).join("\n"));
  if (!WRITE) {
    console.log("Modo prueba: no se guardó nada.");
    return;
  }

  // Un update por categoría, de a 200 productos.
  const byCat = new Map<string, string[]>();
  for (const [pid, cat] of result) byCat.set(cat, [...(byCat.get(cat) || []), pid]);
  for (const [cat, pids] of byCat) {
    const catId = ids.get(cat);
    if (!catId) continue;
    for (let i = 0; i < pids.length; i += 200) {
      const { error } = await db.from("products").update({ category_id: catId }).in("id", pids.slice(i, i + 200));
      if (error) throw error;
    }
  }
  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
