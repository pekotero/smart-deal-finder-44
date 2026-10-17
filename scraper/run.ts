import { scrapeAll } from './vtex-scraper.js';

const QUERIES = [
  'coca cola',
  'pepsi',
  'sprite',
  'leche',
  'yerba mate',
  'arroz',
  'fideos',
  'aceite',
  'azucar',
  'cafe',
];

console.log('Smart Deal Finder - Scraper');
console.log(new Date().toLocaleString('es-AR'));
console.log(`${QUERIES.length} busquedas\n`);

scrapeAll(QUERIES).then(() => {
  console.log('\nListo!');
});