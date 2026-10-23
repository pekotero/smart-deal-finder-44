import { createClient } from "@supabase/supabase-js";
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
  console.log("📝 Cargando variables desde scraper/.env");
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
  console.log("📝 Cargando variables desde la raíz /.env");
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: No se encontraron las credenciales de Supabase.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];

// Logos para cadenas nacionales
const getStoreLogo = (name: string): string | undefined => {
  const lower = name.toLowerCase();
  if (lower.includes("coto")) return "https://www.coto.com.ar/favicon.ico";
  if (lower.includes("carrefour")) return "https://www.carrefour.com.ar/favicon.ico";
  if (lower.includes("jumbo")) return "https://www.jumbo.com.ar/favicon.ico";
  if (lower.includes("vea")) return "https://www.vea.com.ar/favicon.ico";
  if (lower.includes("disco")) return "https://www.disco.com.ar/favicon.ico";
  if (lower.includes("changomâs") || lower.includes("chango mas") || lower.includes("walmart")) return "https://www.changomas.com.ar/favicon.ico";
  if (lower.includes("la anónima") || lower.includes("anonima")) return "https://www.laanonima.com.ar/favicon.ico";
  if (lower.includes("dia")) return "https://diaonline.supermercadosdia.com.ar/favicon.ico";
  if (lower.includes("comodin") || lower.includes("comodín")) return "https://comodin.com.ar/favicon.ico";
  if (lower.includes("cordiez")) return "https://www.cordiez.com.ar/favicon.ico";
  return undefined;
};

async function fetchStoresAllArgentina() {
  console.log("🇦🇷 Escaneando supermercados en TODA LA REPÚBLICA ARGENTINA (Jujuy, Córdoba, CABA, Rosario, Mendoza, etc.)...");

  // Bounding box exacto de Argentina: latitud -55.0 a -21.0, longitud -74.0 a -53.0
  const query = `
    [out:json][timeout:120];
    (
      node["shop"="supermarket"](-55.0, -74.0, -21.0, -53.0);
      way["shop"="supermarket"](-55.0, -74.0, -21.0, -53.0);
    );
    out center;
  `;

  let success = false;
  let data: any = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (success) break;
    
    console.log(`📡 Conectando con satélite: ${new URL(endpoint).hostname}...`);
    
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "SmartDealFinderApp/1.0"
        },
        body: `data=${encodeURIComponent(query)}`
      });

      if (response.ok) {
        data = await response.json();
        success = true;
        console.log("✅ Conexión exitosa. Descargando lista satelital...");
      } else {
        console.warn(`⚠️ Servidor ${new URL(endpoint).hostname} ocupado. Probando siguiente...`);
      }
    } catch (err) {
      console.warn(`❌ Error de conexión con ${new URL(endpoint).hostname}.`);
    }
  }

  if (!success || !data) {
    console.error("❌ Servidores ocupados. Reintentá en unos segundos.");
    return;
  }

  const elements = data.elements || [];
  console.log(`✅ Se detectaron ${elements.length} supermercados físicos en Argentina.`);

  // Obtener tiendas ya guardadas
  const { data: existingStores } = await supabase.from("stores").select("id, name");
  const storeMap = new Map<string, string>();
  if (existingStores) {
    existingStores.forEach((s) => storeMap.set(s.name.toLowerCase(), s.id));
  }

  let newStoresBatch: any[] = [];
  let updatedCount = 0;
  let insertedCount = 0;

  for (const elem of elements) {
    const tags = elem.tags || {};
    const rawName = tags.name || tags["brand"] || tags["operator"];
    
    if (!rawName) continue;

    const lat = elem.lat || (elem.center && elem.center.lat);
    const lon = elem.lon || (elem.center && elem.center.lon);
    if (!lat || !lon) continue;

    const street = tags["addr:street"] || "";
    const number = tags["addr:housenumber"] || "";
    const city = tags["addr:city"] || tags["is_in:city"] || "";
    const address = street ? `${street} ${number}`.trim() : tags["address"] || city || "Argentina";
    
    const brand = tags["brand"] || "";
    let baseName = rawName.trim();
    if (brand && !baseName.toLowerCase().includes(brand.toLowerCase())) {
      baseName = `${brand} ${baseName}`;
    }

    let storeName = baseName;
    if (street && !storeName.toLowerCase().includes(street.toLowerCase())) {
      storeName = `${baseName} (${street}${number ? " " + number : ""}${city ? ", " + city : ""})`;
    } else if (city && !storeName.toLowerCase().includes(city.toLowerCase())) {
      storeName = `${baseName} (${city})`;
    }

    const storeData = {
      name: storeName,
      address: address,
      latitude: lat,
      longitude: lon,
      logo_url: getStoreLogo(baseName)
    };

    const existingId = storeMap.get(storeName.toLowerCase());

    if (existingId) {
      await supabase.from("stores").update(storeData).eq("id", existingId);
      updatedCount++;
    } else {
      newStoresBatch.push(storeData);
      storeMap.set(storeName.toLowerCase(), "pending");

      // Insertar en lotes de 50 para máxima velocidad
      if (newStoresBatch.length >= 50) {
        const { error } = await supabase.from("stores").insert(newStoresBatch);
        if (!error) {
          insertedCount += newStoresBatch.length;
          console.log(`📍 Guardadas ${insertedCount} sucursales nuevas en Supabase...`);
        } else {
          console.warn("⚠️ Error en lote:", error.message);
        }
        newStoresBatch = [];
      }
    }
  }

  // Guardar resto del lote
  if (newStoresBatch.length > 0) {
    const { error } = await supabase.from("stores").insert(newStoresBatch);
    if (!error) {
      insertedCount += newStoresBatch.length;
    }
  }

  console.log(`\n🎉 ¡Finalizado con éxito! Total procesado: ${insertedCount + updatedCount} sucursales (${insertedCount} nuevas registradas, ${updatedCount} actualizadas).`);
}

fetchStoresAllArgentina();