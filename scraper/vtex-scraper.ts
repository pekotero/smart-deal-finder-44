import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const STORES: Record<string, string> = {
  carrefour: 'www.carrefour.com.ar',
  jumbo: 'www.jumbo.com.ar',
  disco: 'www.disco.com.ar',
};

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
  const url = `https://${domain}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}?max=10`;

  console.log(`  Buscando "${query}" en ${storeKey}...`);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    console.log(`  Error conectando a ${storeKey}`);
    return [];
  }
}

async function save(vtexProduct: VTEXProduct, storeKey: string) {
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('chain', storeKey)
    .limit(1)
    .single();

  if (!store) return;

  for (const item of vtexProduct.items) {
    const seller = item.sellers[0];
    if (!seller || seller.commertialOffer.AvailableQuantity === 0) continue;

    const price = seller.commertialOffer.Price;
    const listPrice = seller.commertialOffer.ListPrice;
    const img = item.images[0]?.imageUrl?.replace('http://', 'https://') || null;

    let productId: string | null = null;

    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .ilike('name', vtexProduct.productName)
      .maybeSingle();

    if (existing) {
      productId = existing.id;
    } else {
      const { data: created } = await supabase
        .from('products')
        .insert({
          name: vtexProduct.productName,
          brand: vtexProduct.brand || null,
          image_url: img,
          ean: item.ean || null,
          is_user_contributed: false,
        })
        .select('id')
        .single();

      if (created) {
        productId = created.id;
        console.log(`    + Nuevo: ${vtexProduct.productName}`);
      }
    }

    if (!productId) continue;

    await supabase.from('prices').insert({
      product_id: productId,
      store_id: store.id,
      price,
      original_price: listPrice !== price ? listPrice : null,
      source: 'scraped',
      verified: true,
      last_updated: new Date().toISOString(),
    });
  }
}

export async function scrapeAll(queries: string[]) {
  for (const storeKey of Object.keys(STORES)) {
    console.log(`\n=== ${storeKey.toUpperCase()} ===`);
    for (const q of queries) {
      const products = await search(storeKey, q);
      for (const p of products) {
        await save(p, storeKey);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}