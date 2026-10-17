import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const STORES: Record<string, string> = {
  carrefour: 'www.carrefour.com.ar',
  jumbo: 'www.jumbo.com.ar',
  disco: 'www.disco.com.import { createClient } from '@supabase/supabase-js';
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

async function saveProductAndPrices(vtexProduct: VTEXProduct, storeKey: string) {
  // Obtener TODAS las sucursales de esta cadena
  const { data: stores } = await supabase
    .from('stores')
    .select('id')
    .eq('chain', storeKey);

  if (!stores || stores.length === 0) return;

  for (const item of vtexProduct.items) {
    const seller = item.sellers[0];
    if (!seller || seller.commertialOffer.AvailableQuantity === 0) continue;

    const price = seller.commertialOffer.Price;
    const rawListPrice = seller.commertialOffer.ListPrice;

    // Sanear el precio original para ignorar errores de VTEX (precios inflados o corruptos)
    const validOriginalPrice = (rawListPrice > price && rawListPrice <= price * 2.5) 
      ? rawListPrice 
      : null;

    const img = item.images[0]?.imageUrl?.replace('http://', 'https://') || null;
    const eanCode = item.ean && item.ean.length >= 8 ? item.ean : null;

    let productId: string | null = null;

    // 1. INTENTAR BUSCAR POR CÓDIGO DE BARRAS (EAN)
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

    // 2. SI NO MATCHEA POR EAN, BUSCAR POR NOMBRE EXACTO
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

    // 3. SI NO EXISTE, CREAR EL PRODUCTO NUEVO
    if (!productId) {
      const { data: created, error } = await supabase
        .from('products')
        .insert({
          name: vtexProduct.productName,
          brand: vtexProduct.brand || null,
          image_url: img,
          ean: eanCode,
          is_user_contributed: false,
        })
        .select('id')
        .single();

      if (created) {
        productId = created.id;
        console.log(`    ✨ Nuevo producto global: ${vtexProduct.productName} (EAN: ${eanCode || 'Sin EAN'})`);
      } else if (error) {
        console.error(`    ⚠️ Error al crear producto:`, error.message);
        continue;
      }
    } else {
      console.log(`    🔗 Coincidencia encontrada! Agrupando precio para: ${vtexProduct.productName}`);
    }

    if (!productId) continue;

    // 4. GUARDAR O ACTUALIZAR EL PRECIO PARA TODAS LAS SUCURSALES DE LA CADENA
    for (const store of stores) {
      // Borrar precio viejo si existe para evitar duplicados
      await supabase
        .from('prices')
        .delete()
        .eq('product_id', productId)
        .eq('store_id', store.id);

      // Insertar precio nuevo
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
        await saveProductAndPrices(p, storeKey);
      }
      // Pausa respetuosa para no ser bloqueados
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}
