// Búsqueda de productos por código de barras en las tiendas online VTEX de las cadenas (API
// pública de catálogo, la misma que usan sus sitios). Devuelve foto y categorías de cada EAN.
import { normEan } from "./sepa-lib";

// Cencosud (Jumbo, Disco, Vea) comparte catálogo: con Jumbo alcanza.
export const VTEX_HOSTS = ["www.carrefour.com.ar", "www.jumbo.com.ar", "diaonline.supermercadosdia.com.ar", "www.masonline.com.ar"];
export const BATCH = 40; // EANs por consulta (varios fq del mismo campo se combinan con "o")
export const PAUSE_MS = 400;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Imagen chica (300 px) en vez de la original.
export function smallImage(url: string) {
  return url.replace(/\/arquivos\/ids\/(\d+)(-\d+-\d+)?\//, "/arquivos/ids/$1-300-300/").replace(/^http:/, "https:");
}

export interface VtexInfo {
  image?: string;
  categories: string[]; // "/Almacén/Aceites/"
}

interface VtexProduct {
  categories?: string[];
  items?: { ean?: string; images?: { imageUrl: string }[] }[];
}

export class BlockedError extends Error {
  constructor(public host: string) {
    super(`${host} bloqueó las consultas (403)`);
  }
}

export async function lookupEans(host: string, eans: string[]): Promise<Map<string, VtexInfo>> {
  const fq = eans.map((e) => `fq=alternateIds_Ean:${e}`).join("&");
  const url = `https://${host}/api/catalog_system/pub/products/search?${fq}&_from=0&_to=49`;
  const found = new Map<string, VtexInfo>();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      // 403 = la tienda bloqueó (Cloudflare). No se insiste: se saltea la tienda en esta corrida.
      if (res.status === 403) throw new BlockedError(host);
      if (!res.ok) return found;
      const data = (await res.json()) as VtexProduct[];
      for (const p of data) {
        for (const item of p.items || []) {
          const ean = normEan(item.ean);
          if (!ean || found.has(ean)) continue;
          const img = item.images?.[0]?.imageUrl;
          found.set(ean, { image: img ? smallImage(img) : undefined, categories: p.categories || [] });
        }
      }
      return found;
    } catch (e) {
      if (e instanceof BlockedError) throw e;
      await sleep(2000);
    }
  }
  return found;
}
