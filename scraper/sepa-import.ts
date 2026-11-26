// Precios por sucursal de los datos abiertos SEPA (Precios Claros).
// Para cada zona de sepa-lib.ts toma la sucursal más cercana de cada bandera y carga sus precios.
// Sólo escribe lo que cambió: precios nuevos, precios distintos y los que ya no están.
//
//   npx tsx sepa-import.ts                 baja el último archivo y muestra qué cargaría
//   npx tsx sepa-import.ts --file x.zip    usa un archivo ya bajado
//   npx tsx sepa-import.ts --write         además escribe en la base
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";
import yauzl from "yauzl";
import { chainOf } from "../src/lib/chains";
import { suspiciousPrice } from "./price-rules";
import { BANNERS, Branch, decodeCsv, guessCategory, nearestBranches, normEan, parseCsv, pickDescription, titleCase, ZONES } from "./sepa-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const CKAN = "https://datos.produccion.gob.ar/api/3/action/package_show?id=sepa-precios";

// ---------- zip ----------
type Zip = yauzl.ZipFile;
const opts = { lazyEntries: true, autoClose: false };
const openFile = (p: string) => new Promise<Zip>((ok, ko) => yauzl.open(p, opts, (e, z) => (e ? ko(e) : ok(z!))));
const openBuffer = (b: Buffer) => new Promise<Zip>((ok, ko) => yauzl.fromBuffer(b, opts, (e, z) => (e ? ko(e) : ok(z!))));
function entries(z: Zip) {
  return new Promise<yauzl.Entry[]>((ok, ko) => {
    const out: yauzl.Entry[] = [];
    z.on("entry", (e: yauzl.Entry) => {
      out.push(e);
      z.readEntry();
    });
    z.on("end", () => ok(out));
    z.on("error", ko);
    z.readEntry();
  });
}
const stream = (z: Zip, e: yauzl.Entry) =>
  new Promise<Readable>((ok, ko) => z.openReadStream(e, (err, s) => (err ? ko(err) : ok(s!))));
async function readAll(z: Zip, e: yauzl.Entry) {
  const chunks: Buffer[] = [];
  for await (const c of await stream(z, e)) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}
const isUtf8 = (b: Buffer) => {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(b);
    return true;
  } catch {
    return false;
  }
};

// ---------- descarga ----------
async function download(): Promise<string> {
  const pkg = await (await fetch(CKAN)).json();
  const zips = (pkg.result.resources as { name: string; url: string; last_modified: string }[])
    .filter((r) => /\.zip$/i.test(r.url))
    .sort((a, b) => b.last_modified.localeCompare(a.last_modified));
  const r = zips[0];
  const dest = path.join(os.tmpdir(), "sepa-" + path.basename(r.url));
  console.log(`Bajando ${r.name} (publicado ${r.last_modified.slice(0, 16)})...`);
  const res = await fetch(r.url);
  if (!res.ok || !res.body) throw new Error(`No se pudo bajar ${r.url}: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(dest));
  console.log(`Listo: ${(fs.statSync(dest).size / 1e6).toFixed(0)} MB`);
  return dest;
}

// ---------- lectura ----------
interface Chosen extends Branch {
  zone: string;
  km: number;
  name: string;
  chain: string;
  locality: string;
}

async function readSepa(file: string) {
  const outer = await openFile(file);
  const chosen: Chosen[] = [];
  const parsedCompanies = new Set<string>();
  // precio por sucursal y EAN; descripciones y marca por EAN.
  const prices = new Map<string, Map<string, number>>();
  const info = new Map<string, { descs: Record<string, string>; brand: string }>();

  for (const e of await entries(outer)) {
    const company = e.fileName.match(/comercio-sepa-(\d+)_/)?.[1];
    if (!company || e.uncompressedSize < 1000) continue;
    if (!Object.keys(BANNERS).some((k) => k.startsWith(company + "-"))) continue;

    const inner = await openBuffer(await readAll(outer, e));
    const files = new Map((await entries(inner)).map((x) => [x.fileName.split("/").pop()!, x]));
    const sucEntry = files.get("sucursales.csv");
    const prodEntry = files.get("productos.csv");
    if (!sucEntry || !prodEntry) {
      console.warn(`Comercio ${company}: faltan archivos, se saltea.`);
      inner.close();
      continue;
    }
    const sucBuf = await readAll(inner, sucEntry);
    const branches: (Branch & { locality: string })[] = [];
    for (const s of parseCsv(decodeCsv(sucBuf))) {
      const banner = `${s.id_comercio}-${s.id_bandera}`;
      const lat = parseFloat(s.sucursales_latitud);
      const lng = parseFloat(s.sucursales_longitud);
      if (!BANNERS[banner] || !lat || !lng) continue;
      const street = titleCase(`${s.sucursales_calle} ${s.sucursales_numero}`.trim());
      branches.push({
        key: `${banner}-${s.id_sucursal}`,
        banner,
        group: BANNERS[banner],
        lat,
        lng,
        address: street,
        locality: titleCase(s.sucursales_localidad || ""),
      });
    }
    const near = nearestBranches(branches, ZONES) as (Branch & { locality: string; zone: string; km: number })[];
    parsedCompanies.add(company);
    if (!near.length) {
      inner.close();
      continue;
    }
    for (const b of near) {
      const name = `${BANNERS[b.banner]} (${[b.address, b.locality].filter(Boolean).join(", ")})`;
      chosen.push({ ...b, name, chain: chainOf(name) });
      prices.set(b.key, new Map());
    }

    // productos.csv puede pesar más de 1 GB: se lee línea por línea y sólo se guardan las sucursales elegidas.
    const enc = isUtf8(sucBuf) ? "utf8" : "latin1";
    const s = await stream(inner, prodEntry);
    s.setEncoding(enc);
    let ix: Record<string, number> | null = null;
    for await (const raw of readline.createInterface({ input: s, crlfDelay: Infinity })) {
      const f = raw.replace(/^﻿/, "").split("|");
      if (!ix) {
        ix = Object.fromEntries(f.map((h, i) => [h.trim(), i]));
        continue;
      }
      const key = `${f[ix.id_comercio]}-${f[ix.id_bandera]}-${f[ix.id_sucursal]}`;
      const branch = prices.get(key);
      if (!branch) continue;
      if (f[ix.productos_ean]?.trim() === "0") continue; // código interno, no EAN
      const ean = normEan(f[ix.id_producto]);
      const price = parseFloat(f[ix.productos_precio_lista]);
      if (!ean || !(price > 0)) continue;
      branch.set(ean, price);
      const it = info.get(ean) ?? { descs: {}, brand: "" };
      const desc = f[ix.productos_descripcion]?.trim();
      if (desc && !it.descs[company]) it.descs[company] = desc;
      if (!it.brand) it.brand = f[ix.productos_marca]?.trim() || "";
      info.set(ean, it);
    }
    inner.close();
    console.log(`Comercio ${company}: ${near.map((b) => `${BANNERS[b.banner]} ${prices.get(b.key)!.size}`).join(", ")}`);
  }
  outer.close();
  return { chosen, parsedCompanies, prices, info };
}

// Saca los precios que no tienen sentido contra los de otras cadenas de la misma zona.
function dropOutliers(chosen: Chosen[], prices: Map<string, Map<string, number>>) {
  const dropped = new Map<string, number>();
  for (const zone of new Set(chosen.map((c) => c.zone))) {
    const inZone = chosen.filter((c) => c.zone === zone);
    const byEan = new Map<string, { key: string; chain: string; price: number }[]>();
    for (const c of inZone)
      for (const [ean, price] of prices.get(c.key)!) {
        const list = byEan.get(ean) ?? [];
        list.push({ key: c.key, chain: c.chain, price });
        byEan.set(ean, list);
      }
    for (const [e, list] of byEan)
      for (const p of list) {
        const others = list.filter((o) => o.chain !== p.chain).map((o) => o.price);
        if (suspiciousPrice(p.price, null, others)) {
          prices.get(p.key)!.delete(e);
          dropped.set(p.key, (dropped.get(p.key) || 0) + 1);
        }
      }
  }
  return dropped;
}

// ---------- base ----------
function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY");
  return createClient(url, key, { realtime: { transport: { WebSocket: null } as never } });
}
type DB = ReturnType<typeof db>;

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function productIds(sb: DB, info: Map<string, { descs: Record<string, string>; brand: string }>, needed: Set<string>) {
  const existing = await all<{ id: string; ean: string | null }>((a, b) => sb.from("products").select("id, ean").order("id").range(a, b));
  const ids = new Map<string, string>();
  for (const p of existing) {
    const e = normEan(p.ean);
    if (e && !ids.has(e)) ids.set(e, p.id);
  }
  const missing = [...needed].filter((e) => !ids.has(e));
  if (!WRITE) return { ids, created: missing.length };
  const cats = new Map(((await sb.from("categories").select("id, name")).data || []).map((c) => [c.name, c.id]));
  for (const part of chunks(missing, 500)) {
    const rows = part.map((e) => {
      const it = info.get(e)!;
      const name = pickDescription(it.descs);
      const cat = guessCategory(name);
      return { name, brand: it.brand ? titleCase(it.brand) : null, ean: e, category_id: cat ? cats.get(cat) ?? null : null };
    });
    const { data, error } = await sb.from("products").insert(rows).select("id, ean");
    if (error) throw error;
    for (const p of data!) ids.set(normEan(p.ean)!, p.id);
  }
  return { ids, created: missing.length };
}

async function writeBranch(sb: DB, c: Chosen, branchPrices: Map<string, number>, ids: Map<string, string>) {
  const { data: store, error } = await sb
    .from("stores")
    .upsert(
      { sepa_id: c.key, name: c.name, chain: c.chain, address: [c.address, c.locality].filter(Boolean).join(", "), latitude: c.lat, longitude: c.lng, price_source: "sepa", is_open: true },
      { onConflict: "sepa_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  const storeId = store.id as string;

  const current = await all<{ id: string; product_id: string; price: number }>((a, b) =>
    sb.from("prices").select("id, product_id, price").eq("store_id", storeId).order("id").range(a, b),
  );
  const want = new Map<string, number>();
  for (const [e, price] of branchPrices) {
    const pid = ids.get(e);
    if (pid) want.set(pid, price);
  }
  // Si el archivo de hoy trae mucho menos que lo cargado, seguro vino cortado: no se toca nada.
  if (current.length > 500 && want.size < current.length / 2) {
    console.warn(`${c.name}: hoy vinieron ${want.size} precios contra ${current.length} cargados; se saltea.`);
    return { inserted: 0, updated: 0, deleted: 0 };
  }
  const now = new Date().toISOString();
  const have = new Map(current.map((p) => [p.product_id, p]));
  const inserts = [...want].filter(([pid]) => !have.has(pid)).map(([pid, price]) => ({ product_id: pid, store_id: storeId, price, last_updated: now, verified: true }));
  const updates = current
    .filter((p) => want.has(p.product_id) && Number(p.price) !== want.get(p.product_id))
    .map((p) => ({ id: p.id, product_id: p.product_id, store_id: storeId, price: want.get(p.product_id)!, last_updated: now, verified: true }));
  const gone = current.filter((p) => !want.has(p.product_id)).map((p) => p.id);

  for (const part of chunks(inserts, 1000)) {
    const { error: e } = await sb.from("prices").insert(part);
    if (e) throw e;
  }
  for (const part of chunks(updates, 1000)) {
    const { error: e } = await sb.from("prices").upsert(part);
    if (e) throw e;
  }
  for (const part of chunks(gone, 200)) {
    const { error: e } = await sb.from("prices").delete().in("id", part);
    if (e) throw e;
  }
  return { inserted: inserts.length, updated: updates.length, deleted: gone.length };
}

// Sucursales SEPA que ya no se eligen (otra quedó más cerca): se les sacan los precios.
async function retireOld(sb: DB, chosen: Chosen[], parsedCompanies: Set<string>) {
  const keep = new Set(chosen.map((c) => c.key));
  const { data, error } = await sb.from("stores").select("id, name, sepa_id").eq("price_source", "sepa");
  if (error) throw error;
  for (const s of data || []) {
    if (keep.has(s.sepa_id) || !parsedCompanies.has(String(s.sepa_id).split("-")[0])) continue;
    const { error: e1 } = await sb.from("prices").delete().eq("store_id", s.id);
    if (e1) throw e1;
    const { error: e2 } = await sb.from("stores").update({ price_source: null }).eq("id", s.id);
    if (e2) throw e2;
    console.log(`${s.name}: ya no se usa, se borraron sus precios.`);
  }
}

// ---------- main ----------
const file = fileArg || (await download());
const { chosen, parsedCompanies, prices, info } = await readSepa(file);
const dropped = dropOutliers(chosen, prices);

console.log("\nSucursales elegidas:");
for (const c of chosen)
  console.log(`  ${c.zone} · ${c.name} · ${c.km.toFixed(1)} km · ${prices.get(c.key)!.size} precios${dropped.get(c.key) ? ` (${dropped.get(c.key)} descartados)` : ""}`);

const needed = new Set<string>();
for (const m of prices.values()) for (const e of m.keys()) needed.add(e);
const total = [...prices.values()].reduce((s, m) => s + m.size, 0);
console.log(`\n${total} precios de ${needed.size} productos distintos.`);

const sb = db();
const { ids, created } = await productIds(sb, info, needed);
console.log(`${needed.size - created} productos ya estaban; ${created} ${WRITE ? "creados" : "se crearían"} (sin foto).`);

if (!WRITE) {
  const sample = [...needed].filter((e) => !ids.has(e)).slice(0, 12);
  console.log("\nEjemplos de nombres nuevos:");
  for (const e of sample) {
    const name = pickDescription(info.get(e)!.descs);
    console.log(`  ${name}  [${guessCategory(name) ?? "sin categoría"}]`);
  }
  console.log("\nModo prueba: no se escribió nada. Con --write se carga.");
} else {
  for (const c of chosen) {
    const r = await writeBranch(sb, c, prices.get(c.key)!, ids);
    console.log(`${c.name}: ${r.inserted} nuevos, ${r.updated} cambiaron, ${r.deleted} ya no están.`);
  }
  await retireOld(sb, chosen, parsedCompanies);
  console.log("Listo.");
}
