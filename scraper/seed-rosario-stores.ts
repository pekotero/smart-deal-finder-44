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

const MAIN_CHAINS = [
  { name: 'Coto', address: 'Argentina', latitude: -32.9468, longitude: -60.6393 },
  { name: 'Carrefour', address: 'Argentina', latitude: -32.9515, longitude: -60.6558 },
  { name: 'Jumbo', address: 'Argentina', latitude: -32.9125, longitude: -60.6725 },
  { name: 'La Reina', address: 'Argentina', latitude: -32.9698, longitude: -60.6425 },
  { name: 'La Gallega', address: 'Argentina', latitude: -32.9565, longitude: -60.6512 },
  { name: 'Arcoiris', address: 'Argentina', latitude: -32.9485, longitude: -60.6775 },
  { name: 'DAR', address: 'Argentina', latitude: -32.9500, longitude: -60.6600 },
  { name: 'La Anónima', address: 'Argentina', latitude: -32.9400, longitude: -60.6500 }
];

async function consolidateChains() {
  console.log('🧹 Limpiando y unificando sucursales a nivel Cadena Nacional...\n');

  for (const chain of MAIN_CHAINS) {
    let mainStoreId: string;

    // 1. Obtener o crear la cadena principal (nombre exacto "Coto", "Carrefour", etc.)
    const { data: exactStore } = await supabase
      .from('stores')
      .select('id')
      .eq('name', chain.name)
      .maybeSingle();

    if (exactStore) {
      mainStoreId = exactStore.id;
      await supabase.from('stores').update({
        address: chain.address,
        latitude: chain.latitude,
        longitude: chain.longitude
      }).eq('id', mainStoreId);
    } else {
      const { data: created, error } = await supabase
        .from('stores')
        .insert({
          name: chain.name,
          address: chain.address,
          latitude: chain.latitude,
          longitude: chain.longitude
        })
        .select('id')
        .single();

      if (error || !created) {
        console.error(`❌ Error creando cadena ${chain.name}:`, error?.message);
        continue;
      }
      mainStoreId = created.id;
    }

    // 2. Buscar sucursales viejas (ej: "Coto Centro", "Coto Alto Rosario") y consolidarlas
    const { data: duplicates } = await supabase
      .from('stores')
      .select('id, name')
      .ilike('name', `%${chain.name}%`)
      .neq('id', mainStoreId);

    if (duplicates && duplicates.length > 0) {
      for (const dup of duplicates) {
        // Re-vincular los precios de la sucursal a la cadena principal
        await supabase
          .from('prices')
          .update({ store_id: mainStoreId })
          .eq('store_id', dup.id);

        // Eliminar la sucursal duplicada
        await supabase.from('stores').delete().eq('id', dup.id);
        console.log(`  🔄 Unificada sucursal "${dup.name}" -> Cadena "${chain.name}"`);
      }
    }

    console.log(`  ✅ Cadena unificada: "${chain.name}"`);
  }

  console.log('\n✨ Proceso completado. La base de datos ahora contiene únicamente cadenas nacionales.');
}

consolidateChains();