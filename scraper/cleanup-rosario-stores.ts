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

const ROSARIO_LAT = -32.9468;
const ROSARIO_LNG = -60.6393;

function getDistanceInKm(lat1: number, lon1: number, lat2 = ROSARIO_LAT, lon2 = ROSARIO_LNG): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const VALID_ROSARIO_CHAINS = [
  'Coto',
  'Carrefour',
  'Jumbo',
  'La Reina',
  'La Gallega',
  'Arcoiris',
  'DAR',
  'La Anónima'
];

async function cleanupStores() {
  console.log('🧹 Limpiando tiendas fuera de Rosario y registros duplicados en Supabase...\n');

  // 1. Obtener todas las tiendas
  const { data: stores, error } = await supabase.from('stores').select('id, name, address, latitude, longitude');

  if (error || !stores) {
    console.error('❌ Error obteniendo tiendas:', error?.message);
    return;
  }

  for (const store of stores) {
    const isValidadName = VALID_ROSARIO_CHAINS.some(c => store.name.trim().toLowerCase() === c.toLowerCase());
    const isDisco = store.name.toLowerCase().includes('disco');
    const isRecoleta = (store.address || '').toLowerCase().includes('recoleta') || store.name.toLowerCase().includes('recoleta');
    const dist = getDistanceInKm(store.latitude || ROSARIO_LAT, store.longitude || ROSARIO_LNG);

    // Si es "Disco", "Recoleta" o no coincide con el nombre exacto de la cadena
    if (isDisco || isRecoleta || !isValidadName || dist > 30) {
      console.log(`  🗑️ Eliminando tienda fuera de radio/no válida: "${store.name}" (${store.address || 'Sin dir'}) - Distancia: ${Math.round(dist)}km`);
      
      // Borrar precios asociados primero
      await supabase.from('prices').delete().eq('store_id', store.id);
      // Borrar tienda
      await supabase.from('stores').delete().eq('id', store.id);
    }
  }

  console.log('\n✨ Limpieza de base de datos finalizada. Solo quedan tiendas de Rosario en un radio < 30km.');
}

cleanupStores();