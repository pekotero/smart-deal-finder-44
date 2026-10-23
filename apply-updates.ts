import fs from "fs";
import path from "path";

console.log("🚀 Cambiando título y favicon de la aplicación...");

const indexHtmlContent = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Smart Deal Finder - Compará Precios de Supermercados</title>
    <meta name="description" content="Compará precios en tiempo real entre Coto, Carrefour, Jumbo y más en Rosario y toda Argentina." />
    <meta name="author" content="Smart Deal Finder" />

    <!-- Icono de la pestaña del navegador (Changuito de Compras) -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛒</text></svg>" />

    <!-- Estilos de Leaflet para el Mapa -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
         integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
         crossorigin=""/>
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(process.cwd(), "index.html"), indexHtmlContent, "utf-8");

console.log("✅ index.html actualizado con el nombre 'Smart Deal Finder' e icono 🛒");