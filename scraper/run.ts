import { scrapeAll } from './vtex-scraper.js';

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

console.log('Smart Deal Finder - Scraper Extendido');
console.log(new Date().toLocaleString('es-AR'));
console.log(`${QUERIES.length} búsquedas programadas\n`);

scrapeAll(QUERIES)
  .then(() => {
    console.log('\n========================================');
    console.log('¡Escaneo completo finalizado con éxito!');
    console.log('========================================');
  })
  .catch((err) => {
    console.error('Error durante el escaneo:', err);
  });