import fs from "fs";
import path from "path";

console.log("🚀 Corrigiendo workflow para Node 22...");

const workflowContent = `name: Actualización diaria de precios

on:
  schedule:
    - cron: "0 9 * * *"
  workflow_dispatch:

jobs:
  update-prices:
    runs-on: ubuntu-latest
    steps:
      - name: Descargar repositorio
        uses: actions/checkout@v4
      - name: Configurar Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
      - name: Instalar dependencias
        run: |
          npm install
          npm --prefix scraper install
      - name: Ejecutar scraper de precios
        working-directory: ./scraper
        env:
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: \${{ secrets.SUPABASE_SERVICE_KEY }}
        run: npx tsx scrape-prices-all.ts
`;

const scraperCode = `import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

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
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-z0-9\\s]/g, " ")
    .replace(/\\s+/g, " ").trim();
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
      const price = Number(dataObj.product_list_price || dataObj.price || (dataObj.price && dataObj.price[0]?.listPrice));
      if (!price || isNaN(price) || price <= 0) continue;
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

async function scrapeCarrefour(keyword) {
  const products = [];
  try {
    const url = "https://www.carrefour.com.ar/api/catalog_system/pub/products/search/" + encodeURIComponent(keyword) + "?_from=0&_to=15";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return products;
    const items = await res.json();
    if (!Array.isArray(items)) return products;
    for (const item of items) {
      const sku = item.items?.[0];
      const seller = sku?.sellers?.[0]?.commertialOffer;
      const price = Number(seller?.Price);
      if (!price || isNaN(price) || price <= 0) continue;
      const name = item.productName || "";
      const ean = sku?.ean;
      const originalPrice = Number(seller?.ListPrice);
      products.push({
        storeChain: "Carrefour", name, cleanName: sanitizeName(name),
        ean: ean ? String(ean) : undefined, price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
        imageUrl: sku?.images?.[0]?.imageUrl
      });
    }
  } catch (err) {
    console.warn("Error scrapeando Carrefour para " + keyword);
  }
  return products;
}

async function scrapeJumbo(keyword) {
  const products = [];
  try {
    const url = "https://www.jumbo.com.ar/api/catalog_system/pub/products/search/" + encodeURIComponent(keyword) + "?_from=0&_to=15";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return products;
    const items = await res.json();
    if (!Array.isArray(items)) return products;
    for (const item of items) {
      const sku = item.items?.[0];
      const seller = sku?.sellers?.[0]?.commertialOffer;
      const price = Number(seller?.Price);
      if (!price || isNaN(price) || price <= 0) continue;
      const name = item.productName || "";
      const ean = sku?.ean;
      const originalPrice = Number(seller?.ListPrice);
      products.push({
        storeChain: "Jumbo", name, cleanName: sanitizeName(name),
        ean: ean ? String(ean) : undefined, price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
        imageUrl: sku?.images?.[0]?.imageUrl
      });
    }
  } catch (err) {
    console.warn("Error scrapeando Jumbo para " + keyword);
  }
  return products;
}

async function startPriceScraper() {
  console.log("Extrayendo precios de Coto, Carrefour y Jumbo...");
  const { data: stores } = await supabase.from("stores").select("id, name");
  if (!stores || stores.length === 0) {
    console.error("No se encontraron tiendas en la base de datos.");
    return;
  }
  const getStoreIdForChain = (chain) => {
    const matched = stores.find((s) => s.name.toLowerCase().includes(chain.toLowerCase()));
    return matched ? matched.id : stores[0].id;
  };
  let totalItemsScraped = 0;
  for (const keyword of SEARCH_KEYWORDS) {
    console.log("Buscando ofertas para: " + keyword + "...");
    const [cotoItems, carrefourItems, jumboItems] = await Promise.all([
      scrapeCoto(keyword), scrapeCarrefour(keyword), scrapeJumbo(keyword)
    ]);
    const allItems = [...cotoItems, ...carrefourItems, ...jumboItems];
    console.log("  Encontrados: Coto (" + cotoItems.length + "), Carrefour (" + carrefourItems.length + "), Jumbo (" + jumboItems.length + ")");
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
`;

// Guardar archivos
const workflowDir = path.join(process.cwd(), ".github", "workflows");
if (!fs.existsSync(workflowDir)) fs.mkdirSync(workflowDir, { recursive: true });
fs.writeFileSync(path.join(workflowDir, "daily-scraper.yml"), workflowContent, "utf-8");

const scraperDir = path.join(process.cwd(), "scraper");
if (!fs.existsSync(scraperDir)) fs.mkdirSync(scraperDir, { recursive: true });
fs.writeFileSync(path.join(scraperDir, "scrape-prices-all.ts"), scraperCode, "utf-8");

console.log("✅ Archivos actualizados correctamente.");