import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { cotoAvailable, sanePreviousPrice, vtexAvailable } from "./price-rules";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, ".env");
const rootEnvPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: No se encontraron las credenciales de Supabase.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: { WebSocket: null } }
});

const SEARCH_KEYWORDS = [
  "leche", "aceite", "yerba", "azucar", "fideos",
  "arroz", "galletitas", "coca cola", "cafe", "jabon",
  "manteca", "queso", "yogur", "detergente"
];

function sanitizeName(name) {
  return name.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

async function scrapeCoto(keyword) {
  const products = [];
  try {
    const url = "https://ac.cnstrc.com/search/" + encodeURIComponent(keyword) + "?key=key_r6xzz4IAoTWcipni&num_results_per_page=15";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return products;
    const data = await res.json();
    const results = data.response?.results || [];
    for (const item of results) {
      const dataObj = item.data || {};
      const price = Number(dataObj.product_list_price || (Array.isArray(dataObj.price) && dataObj.price[0]?.listPrice));
      if (!price || isNaN(price) || price <= 0) continue;
      if (!cotoAvailable(dataObj)) continue; // sin stock: precio viejo
      const name = item.value || dataObj.name || "";
      const ean = dataObj.gtin || dataObj.ean || dataObj.id;
      products.push({
        storeChain: "Coto", name, cleanName: sanitizeName(name),
        ean: ean ? String(ean) : undefined, price,
        imageUrl: dataObj.image_url || dataObj.imageUrl
      });
    }
  } catch (err) {
    console.warn("Error scrapeando Coto para " + keyword);
  }
  return products;
}

// Cadenas VTEX: misma API pública. storePattern es la sucursal donde se guardan sus precios
// online (tiene que ser inequívoca: "Dia%" también agarra "Diarco").
const VTEX_CHAINS = [
  { chain: "Carrefour", host: "www.carrefour.com.ar", storePattern: "Carrefour%" },
  { chain: "Jumbo", host: "www.jumbo.com.ar", storePattern: "Jumbo%" },
  { chain: "Disco", host: "www.disco.com.ar", storePattern: "Disco (%" },
  { chain: "Vea", host: "www.vea.com.ar", storePattern: "Vea (%" },
  { chain: "Día", host: "diaonline.supermercadosdia.com.ar", storePattern: "Dia (%" },
  { chain: "ChangoMás", host: "www.masonline.com.ar", storePattern: "ChangoMâs (%" },
];

async function scrapeVtex({ chain, host }, keyword) {
  const products = [];
  try {
    const url = "https://" + host + "/api/catalog_system/pub/products/search/" + encodeURIComponent(keyword) + "?_from=0&_to=15";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return products;
    const items = await res.json();
    if (!Array.isArray(items)) return products;
    for (const item of items) {
      const sku = item.items?.[0];
      const seller = sku?.sellers?.[0]?.commertialOffer;
      const price = Number(seller?.Price);
      if (!price || isNaN(price) || price <= 0) continue;
      if (!vtexAvailable(seller)) continue; // sin stock: precio viejo
      const name = item.productName || "";
      const ean = sku?.ean;
      products.push({
        storeChain: chain, name, cleanName: sanitizeName(name),
        ean: ean ? String(ean) : undefined, price,
        originalPrice: sanePreviousPrice(price, seller?.ListPrice) ?? undefined,
        imageUrl: sku?.images?.[0]?.imageUrl
      });
    }
  } catch (err) {
    console.warn("Error scrapeando " + chain + " para " + keyword);
  }
  return products;
}

async function startPriceScraper() {
  console.log("Extrayendo precios de Coto, " + VTEX_CHAINS.map((c) => c.chain).join(", ") + "...");
  // Una tienda por cadena, cuyo nombre empiece con la cadena. Antes se buscaba entre las primeras
  // 1000 tiendas y, si no aparecía, se usaba la primera de la lista (de otra cadena).
  const storeByChain = {};
  for (const { chain, storePattern } of [{ chain: "Coto", storePattern: "Coto%" }, ...VTEX_CHAINS]) {
    const { data } = await supabase.from("stores").select("id").ilike("name", storePattern).order("id").limit(1).maybeSingle();
    if (data) storeByChain[chain] = data.id;
    else console.warn("No se encontró tienda para " + chain + ": se saltean sus precios.");
  }
  const getStoreIdForChain = (chain) => storeByChain[chain] || null;
  let totalItemsScraped = 0;
  for (const keyword of SEARCH_KEYWORDS) {
    console.log("Buscando ofertas para: " + keyword + "...");
    const [cotoItems, ...vtexItems] = await Promise.all([
      scrapeCoto(keyword), ...VTEX_CHAINS.map((c) => scrapeVtex(c, keyword))
    ]);
    const allItems = [...cotoItems, ...vtexItems.flat()];
    console.log("  Encontrados: Coto (" + cotoItems.length + "), " + VTEX_CHAINS.map((c, i) => c.chain + " (" + vtexItems[i].length + ")").join(", "));
    for (const item of allItems) {
      let existingProductId = null;
      if (item.ean) {
        const { data: byEan } = await supabase.from("products").select("id").eq("ean", item.ean).maybeSingle();
        if (byEan) existingProductId = byEan.id;
      }
      if (!existingProductId) {
        const { data: byName } = await supabase.from("products").select("id").ilike("name", "%" + item.name + "%").maybeSingle();
        if (byName) existingProductId = byName.id;
      }
      if (!existingProductId) {
        const { data: newProd } = await supabase.from("products").insert({
          name: item.name,
          image_url: item.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80",
          ean: item.ean || null
        }).select("id").single();
        if (!newProd) continue;
        existingProductId = newProd.id;
      }
      const storeId = getStoreIdForChain(item.storeChain);
      if (!storeId) continue;
      await supabase.from("prices").delete().eq("product_id", existingProductId).eq("store_id", storeId);
      await supabase.from("prices").insert({
        product_id: existingProductId,
        store_id: storeId,
        price: item.price,
        original_price: item.originalPrice || null
      });
      totalItemsScraped++;
    }
  }
  console.log("Sincronizacion finalizada! Se registraron " + totalItemsScraped + " ofertas.");
}

startPriceScraper();
