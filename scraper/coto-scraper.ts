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

const COTO_KEY = 'key_r6xzz4IAoTWcipni';

async function getStoreId() {
  const { data } = await supabase.from('stores').select('id, name').ilike('name', '%coto%').limit(1).maybeSingle();
  return data;
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

async function fetchFromConstructor(query: string) {
  const cleanQuery = encodeURIComponent(query.trim().toLowerCase());
  const session = Math.floor(Math.random() * 10000000);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Origin': 'https://www.cotodigital3.com.ar',
    'Referer': 'https://www.cotodigital3.com.ar/',
    'Accept-Language': 'es-AR,es;q=0.9',
  };

  const urlAuto = `https://ac.cnstrc.com/autocomplete/${cleanQuery}?key=${COTO_KEY}&c=ciojs-client-2.29.3&i=${session}&s=${session}&num_results_Products=25`;
  let res = await fetch(urlAuto, { headers });
  let json: any = await res.json().catch(() => null);
  
  if (json?.sections?.Products?.length > 0) {
    return json.sections.Products;
  }

  const urlSearch = `https://ac.cnstrc.com/search/${cleanQuery}?key=${COTO_KEY}&c=ciojs-client-2.29.3&i=${session}&s=${session}&num_results_per_page=25&page=1`;
  res = await fetch(urlSearch, { headers });
  json = await res.json().catch(() => null);

  if (json?.response?.results?.length > 0) {
    return json.response.results;
  }
  
  return [];
}

export async function scrapeCoto(queries: string[]) {
  console.log('\n========================================');
  console.log('🛒 ESCANEANDO: COTO DIGITAL (Constructor.io)');
  console.log('========================================');

  const store = await getStoreId();
  if (!store) {
    console.error('❌ No se encontró tienda Coto en Supabase. Ejecuta seed-rosario-stores.ts');
    return;
  }
  const catMap = await getCategoryMap();

  for (const query of queries) {
    console.log(`\n  🔍 Buscando "${query}" en Coto...`);
    try {
      const products = await fetchFromConstructor(query);

      if (products.length === 0) {
        console.log(`    ⚠️ Sin resultados para "${query}"`);
        continue;
      }

      let inserted = 0;
      for (const item of products) {
        const name = item.value || item.data?.sku_display_name || item.data?.sku_description || '';
        const brand = item.data?.product_brand || name.split(' ')[0];
        const image = item.data?.product_large_image_url || item.data?.image_url || '';

        // Extracción exacta del precio basada en la respuesta real de la API
        let priceNum = Number(item.data?.product_list_price);
        if (isNaN(priceNum) || priceNum <= 0) {
          if (Array.isArray(item.data?.price) && item.data.price.length > 0) {
            priceNum = Number(item.data.price[0].listPrice);
          }
        }
        
        if (!name || isNaN(priceNum) || priceNum <= 0) {
          continue;
        }

        const category_id = mapCategoryId(name, catMap);

        let productId: string;
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('name', name)
          .maybeSingle();

        if (existing) {
          productId = existing.id;
        } else {
          const { data: newProd, error: insertProdErr } = await supabase
            .from('products')
            .insert({
              name: name,
              brand: brand,
              image_url: image,
              category_id: category_id
            })
            .select('id')
            .single();

          if (insertProdErr || !newProd) {
            console.log(`      ❌ Error creando producto "${name}":`, insertProdErr?.message);
            continue;
          }
          productId = newProd.id;
        }

        // Limpieza y carga de precio
        await supabase.from('prices').delete().eq('product_id', productId).eq('store_id', store.id);

        const { error: priceError } = await supabase.from('prices').insert({
          product_id: productId,
          store_id: store.id,
          price: priceNum,
          original_price: priceNum
        });

        if (priceError) {
          console.log(`      ❌ Error precio "${name}":`, priceError.message);
        } else {
          inserted++;
        }
      }
      console.log(`    ✅ Guardados ${inserted}/${products.length} para "${query}"`);

    } catch (e) {
      console.error(`    ❌ Error en "${query}":`, e);
    }
    await new Promise(r => setTimeout(r, 800));
  }
}

// Permite ejecutarlo directo para test
const isDirectRun = process.argv[1]?.includes('coto-scraper');
if (isDirectRun) {
  scrapeCoto(["coca cola"]).then(() => {
    console.log('\nFIN TEST COTO');
    process.exit(0);
  });
}