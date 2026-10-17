import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR FATAL: No se encontraron las credenciales SUPABASE_URL o SUPABASE_SERVICE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const STORES: Record<string, string> = {
  carrefour: 'www.carrefour.com.ar',
  jumbo: 'www.jumbo.com.ar',
  disco: 'www.disco.com.ar',
};

// Mapa de búsquedas a nombres de categorías
function getCategoryName(query: string): string {
  const q = query.toLowerCase();
  if (['coca cola', 'pepsi', 'sprite', 'agua mineral', 'cerveza', 'jugo', 'gaseosa'].some(k => q.includes(k))) {
    return 'Bebidas';
  }
  if (['leche', 'yogur', 'manteca', 'queso', 'crema'].some(k => q.includes(k))) {
    return 'Lácteos';
  }
  if (['lavandina', 'detergente', 'jabon', 'papel higienico', 'limpiador'].some(k => q.includes(k))) {
    return 'Limpieza';
  }
  return 'Almacén';
}

// Caché de categorías para no saturar la base de datos
const categoryCache: Record<string, string> = {};

async function getOrCreateCategoryId(categoryName: string): Promise<string | null> {
  if (categoryCache[categoryName]) {
    return categoryCache[categoryName];
  }

  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', categoryName)
    .maybeSingle();

  if (existing) {
    categoryCache[categoryName] = existing.id;
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('categories')
    .insert({
      name: categoryName,
      slug: categoryName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      icon: categoryName === 'Bebidas' ? 'cup-soda' : categoryName === 'Lácteos' ? 'milk' : categoryName === 'Limpieza' ? 'sparkles' : 'shopping-bag'
    })
    .select('id')
    .single();

  if (created) {
    categoryCache[categoryName] = created.id;
    return created.id;
  }

  if (error) {
    console.error(`Error al crear categoría ${categoryName}:`, error.message);
  }

  return null;
}

interface VTEXProduct {
  productId: string;
  productName: string;
  brand: string;
  linkText: string;
  items: {
    itemId: string;
    ean: string;
    images: { imageUrl: string }[];
    sellers: {
      commertialOffer: {
        Price: number;
        ListPrice: number;
        AvailableQuantity: number;
      };
    }[];
  }[];
}

async function search(storeKey: string, query: string): Promise<VTEXProduct[]> {
  const domain = STORES[storeKey];
  const url = `https://${domain}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}?max=15`;

  console.log(`  🔍 Buscando "${query}" en ${storeKey.toUpperCase()}...`);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    console.log(`  ❌ Error conectando a ${storeKey}`);
    return [];
  }
}

async function saveProductAndPrices(vtexProduct: VTEXProduct, storeKey: string, query: string) {
  const { data: stores } = await supabase
    .from('stores')
    .select('id')
    .eq('chain', storeKey);

  if (!stores || stores.length === 0) return;

  const categoryName = getCategoryName(query);
  const categoryId = await getOrCreateCategoryId(categoryName);

  for (const item of vtexProduct.items) {
    const seller = item.sellers[0];
    if (!seller || seller.commertialOffer.AvailableQuantity === 0) continue;

    const price = seller.commertialOffer.Price;
    const rawListPrice = seller.commertialOffer.ListPrice;

    const validOriginalPrice = (rawListPrice > price && rawListPrice <= price * 2.5) 
      ? rawListPrice 
      : null;

    const img = item.images[0]?.imageUrl?.replace('http://', 'https://') || null;
    const eanCode = item.ean && item.ean.length >= 8 ? item.ean : null;

    let productId: string | null = null;

    if (eanCode) {
      const { data: eanMatch } = await supabase
        .from('products')
        .select('id')
        .eq('ean', eanCode)
        .maybeSingle();

      if (eanMatch) {
        productId = eanMatch.id;
      }
    }

    if (!productId) {
      const { data: nameMatch } = await supabase
        .from('products')
        .select('id')
        .ilike('name', vtexProduct.productName)
        .maybeSingle();

      if (nameMatch) {
        productId = nameMatch.id;
      }
    }

    if (!productId) {
      const { data: created, error } = await supabase
        .from('products')
        .insert({
          name: vtexProduct.productName,
          brand: vtexProduct.brand || null,
          image_url: img,
          ean: eanCode,
          category_id: categoryId,
          is_user_contributed: false,
        })
        .select('id')
        .single();

      if (created) {
        productId = created.id;
        console.log(`    ✨ Nuevo producto: ${vtexProduct.productName} [${categoryName}]`);
      } else if (error) {
        console.error(`    ⚠️ Error al crear producto:`, error.message);
        continue;
      }
    } else {
      if (categoryId) {
        await supabase
          .from('products')
          .update({ category_id: categoryId })
          .eq('id', productId);
      }
      console.log(`    🔗 Coincidencia encontrada! Agrupando precio para: ${vtexProduct.productName}`);
    }

    if (!productId) continue;

    for (const store of stores) {
      await supabase
        .from('prices')
        .delete()
        .eq('product_id', productId)
        .eq('store_id', store.id);

      await supabase.from('prices').insert({
        product_id: productId,
        store_id: store.id,
        price,
        original_price: validOriginalPrice,
        source: 'scraped',
        verified: true,
        last_updated: new Date().toISOString(),
      });
    }
  }
}

export async function scrapeAll(queries: string[]) {
  for (const storeKey of Object.keys(STORES)) {
    console.log(`\n========================================`);
    console.log(`🛒 ESCANEANDO: ${storeKey.toUpperCase()}`);
    console.log(`========================================`);
    for (const q of queries) {
      const products = await search(storeKey, q);
      for (const p of products) {
        await saveProductAndPrices(p, storeKey, q);
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}