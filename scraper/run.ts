import { scrapeAll } from './vtex-scraper.js';
import { scrapeCoto } from './coto-scraper.js';

const QUERIES = [
  // Bebidas
  'coca cola',
  'pepsi',
  'sprite',
  'agua mineral',
  'cerveza',
  
  // Lácteos y frescos
  'leche',
  'yogur',
  'manteca',
  'queso cremoso',
  
  // Almacén
  'yerba mate',
  'azucar',
  'cafe',
  'fideos',
  'arroz',
  'aceite girasol',
  'harina 000',
  'pure de tomate',
  
  // Limpieza y perfumería
  'lavandina',
  'detergente',
  'jabon en polvo',
  'papel higienico'
];

async function main() {
  console.log('Smart Deal Finder - Scraper Multicadena');
  console.log(new Date().toLocaleString('es-AR'));
  console.log(`${QUERIES.length} búsquedas programadas\n`);

  try {
    // 1. Escanear Coto Digital PRIMERO
    await scrapeCoto(QUERIES);

    // 2. Escanear cadenas VTEX (Carrefour, Jumbo) después
    await scrapeAll(QUERIES);

    console.log('\n========================================');
    console.log('¡Escaneo completo finalizado con éxito!');
    console.log('========================================');
  } catch (err) {
    console.error('Error durante el escaneo:', err);
  }
}

main();