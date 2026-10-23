import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface VTEXStoreConfig {
  name: string;
  baseUrl: string;
}

const STORES: VTEXStoreConfig[] = [
  { name: 'Carrefour', baseUrl: 'www.carrefour.com.ar' },
  { name: 'Jumbo', baseUrl: 'www.jumbo.com.ar' },
];

function cleanProductName(rawName: string): string {
  return rawName
    .replace(/\b(gaseosa|sabor|original|zero|diet|lt|lts|l|ml|cc|gr|g|kg)\b/gi, '')
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function getCategoryMap() {
  const { data } = await supabase.from('categories').select('id, name');
  const map: Record<string, string> = {};
  data?.forEach(c => map[c.name.toLowerCase()] = c.id);
  return map;
}

function mapCategoryId(productName: string, catMap: Record<string, string>): string | null {
  const lower = productName.toLowerCase();
  if (lower.includes('leche') || lower.includes('yogur') || lower.includes('queso') || lower.includes('crema') || lower.includes('manteca')) {
    return catMap['lácteos'] || catMap['lacteos'] || null;
  }
  if (lower.includes('gaseosa') || lower.includes('coca') || lower.includes('pepsi') || lower.includes('sprite') || lower.includes('agua') || lower.includes('cerveza') || lower.includes('vino') || lower.includes('jugo')) {
    return catMap['bebidas'] || null;
  }
  if (lower.includes('detergente') || lower.includes('lavandina') || lower.includes('jabón') || lower.includes('jabon') || lower.includes('limpieza') || lower.includes('desinfectante')) {
    return catMap['limpieza'] || null;
  }
  return catMap['almacén'] || catMap['almacen'] || null;
}

async function scrapeStore(storeConfig: VTEXStoreConfig, queries: string[], catMap: Record<string, string>) {
  console.log(`\n========================================`);
  console.log(`🛒 ESCANEANDO: ${storeConfig.name.toUpperCase()}`);
  console.log(`========================================`);

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .ilike('name', `%${storeConfig.name}%`)
    .limit(1)
    .maybeSingle();

  if (!store) {
    console.error(`❌ Error: No se encontró la tienda "${storeConfig.name}" en Supabase.`);
    return;
  }

  for (const query of queries) {
    console.log(`  🔍 Buscando "${query}" en ${storeConfig.name}...`);

    try {
      const url = `https://${storeConfig.baseUrl}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}?_from=0&_to=24`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`    ❌ Error HTTP ${response.status} en ${storeConfig.name}`);
        continue;
      }

      const products = await response.json();
      if (!Array.isArray(products) || products.length === 0) {
        console.log(`    ⚠️ Sin resultados para "${query}"`);
        continue;
      }

      let inserted = 0;

      for (const item of products) {
        const sku = item.items?.[0];
        const offer = sku?.sellers?.[0]?.commertialOffer;
        const price = offer?.Price;
        const listPrice = offer?.ListPrice || price;

        if (!price || price <= 0) continue;

        const rawName = item.productName || sku?.nameComplete || '';
        const brand = item.brand || rawName.split(' ')[0];
        const imageUrl = sku?.images?.[0]?.imageUrl || '';
        const ean = sku?.ean || null;

        if (!rawName) continue;

        const category_id = mapCategoryId(rawName, catMap);

        // Agrupación por EAN o Nombre Limpio
        let productId: string | null = null;

        if (ean) {
          const { data: byEan } = await supabase
            .from('products')
            .select('id')
            .eq('ean', ean)
            .maybeSingle();
          if (byEan) productId = byEan.id;
        }

        if (!productId) {
          const { data: byName } = await supabase
            .from('products')
            .select('id')
            .ilike('name', `%${cleanProductName(rawName)}%`)
            .limit(1)
            .maybeSingle();
          if (byName) productId = byName.id;
        }

        if (!productId) {
          const { data: newProd, error: insertProdErr } = await supabase
            .from('products')
            .insert({
              name: rawName,
              brand: brand,
              image_url: imageUrl,
              category_id: category_id,
              ...(ean ? { ean } : {})
            })
            .select('id')
            .single();

          if (insertProdErr || !newProd) continue;
          productId = newProd.id;
        }

        // Actualizar precio de la cadena
        await supabase.from('prices').delete().eq('product_id', productId).eq('store_id', store.id);

        const { error: priceError } = await supabase.from('prices').insert({
          product_id: productId,
          store_id: store.id,
          price: price,
          original_price: listPrice
        });

        if (!priceError) inserted++;
      }

      console.log(`    ✅ Guardados ${inserted}/${products.length} productos para "${query}"`);

    } catch (e) {
      console.error(`    ❌ Error buscando "${query}":`, e);
    }

    await new Promise(resolve => setTimeout(resolve, 800));
  }
}

export async function scrapeAll(queries: string[]) {
  const catMap = await getCategoryMap();
  for (const storeConfig of STORES) {
    await scrapeStore(storeConfig, queries, catMap);
  }
}