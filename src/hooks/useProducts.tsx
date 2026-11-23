import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PriceComparison {
  id: string;
  price: number;
  originalPrice?: number;
  store: string;
  storeName: string;
  store_id?: string;
  distance?: number;
}

export interface Product {
  id: string;
  name: string;
  image: string;
  image_url?: string;
  category: string;
  ean?: string;
  prices: PriceComparison[];
  bestPrice?: number;
  savingsPercentage?: number;
}

export interface UseProductsOptions {
  categoryId?: string | null;
  searchQuery?: string | null;
  userLatitude?: number | null;
  userLongitude?: number | null;
  maxDistanceKm?: number;
  cityId?: string | null;
  // Tiendas cercanas al usuario (las de useStores). Los precios son los online de cada
  // cadena, así que se muestran en la sucursal más cercana de esa cadena.
  nearbyStores?: { id: string; name: string; distance?: number }[];
  // false mientras se esperan la ubicación y las tiendas cercanas.
  enabled?: boolean;
}

interface PriceRow {
  id: string;
  price: number;
  original_price: number | null;
  store_id: string;
  last_updated: string;
  stores: { id: string; name: string };
  products: {
    id: string;
    name: string;
    image_url: string | null;
    ean: string | null;
    category_id: string | null;
    categories: { name: string } | null;
  };
}

// Las cadenas nuevas se reconocen sólo al principio del nombre (con "Supermercado" opcional),
// para no confundir "Diarco", "Buen Día", "El Chango" o "Super Vea" con Día, ChangoMás o Vea.
const CHAIN_PATTERNS: [RegExp, string][] = [
  [/^(supermercados? )?disco\b/i, "Disco"],
  [/^(supermercados? )?vea\b(?! d[ií]a)/i, "Vea"],
  [/^(supermercados? )?d[ií]a\b(?! de\b| a d)/i, "Día"],
  [/^(supermercados? |hiper |walmart (hiper )?)?chango ?m[aáâà]s\b/i, "ChangoMás"],
];

export const chainOf = (storeName: string) => {
  const lower = storeName.toLowerCase();
  if (lower.includes("coto")) return "Coto";
  if (lower.includes("carrefour")) return "Carrefour";
  if (lower.includes("jumbo")) return "Jumbo";
  if (lower.includes("gallega")) return "La Gallega";
  if (lower.includes("reina")) return "La Reina";
  const name = storeName.trim();
  for (const [re, chain] of CHAIN_PATTERNS) if (re.test(name)) return chain;
  return storeName;
};

const PAGE = 1000;
const MAX_PAGES = 10;

export const useProducts = (
  optsOrSearchQuery?: UseProductsOptions | string | null,
  categoryParam?: string | null
) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  let searchQuery = "";
  let categoryId = "all";
  let nearbyStores: NonNullable<UseProductsOptions["nearbyStores"]> = [];
  let enabled = true;

  if (typeof optsOrSearchQuery === "object" && optsOrSearchQuery !== null) {
    searchQuery = optsOrSearchQuery.searchQuery || "";
    categoryId = optsOrSearchQuery.categoryId || "all";
    nearbyStores = optsOrSearchQuery.nearbyStores ?? [];
    enabled = optsOrSearchQuery.enabled ?? true;
  } else {
    searchQuery = typeof optsOrSearchQuery === "string" ? optsOrSearchQuery : "";
    categoryId = categoryParam || "all";
  }

  const storesKey = nearbyStores.map((s) => `${s.id}:${s.distance ?? ""}`).join(",");

  useEffect(() => {
    if (!enabled) return;
    // Si cambian los filtros mientras se carga, la respuesta vieja se descarta.
    let stale = false;

    const fetchProducts = async () => {
      try {
        setLoading(true);

        // Sucursal más cercana de cada cadena entre las tiendas cercanas al usuario.
        const nearestByChain = new Map<string, { id: string; distance?: number }>();
        for (const s of nearbyStores) {
          const chain = chainOf(s.name || "");
          const prev = nearestByChain.get(chain);
          if (!prev || (s.distance ?? Infinity) < (prev.distance ?? Infinity)) {
            nearestByChain.set(chain, { id: s.id, distance: s.distance });
          }
        }

        // Los precios están cargados en pocas tiendas (son los precios online de cada cadena):
        // se bajan todos, paginando porque Supabase devuelve como máximo 1000 filas.
        const rows: PriceRow[] = [];
        for (let page = 0; page < MAX_PAGES; page++) {
          let query = supabase
            .from("prices")
            .select(
              "id, price, original_price, store_id, last_updated, stores!inner(id, name), products!inner(id, name, image_url, ean, category_id, categories(name))",
            );
          if (categoryId && categoryId !== "all" && categoryId !== "Todas") {
            query = query.eq("products.category_id", categoryId);
          }
          if (searchQuery.trim()) query = query.ilike("products.name", `%${searchQuery.trim()}%`);

          const { data, error: fetchErr } = await query.order("id").range(page * PAGE, page * PAGE + PAGE - 1);
          if (fetchErr) throw fetchErr;
          rows.push(...((data || []) as unknown as PriceRow[]));
          if (!data || data.length < PAGE) break;
        }

        // Agrupar por producto: un precio por cadena (el más reciente), ubicado en la sucursal
        // más cercana de esa cadena. Cadenas sin sucursal cerca no se muestran.
        const byProduct = new Map<
          string,
          { info: PriceRow["products"]; chains: Map<string, PriceComparison & { updated: string }> }
        >();
        for (const pr of rows) {
          const chainName = chainOf(pr.stores.name || "Supermercado");
          const branch = nearestByChain.get(chainName);
          if (!branch) continue;
          const price = Number(pr.price);
          // El scraper a veces guarda el precio anterior multiplicado por 100 ($355.000 en una
          // leche de $3.550): sólo se muestra tachado si es mayor y como mucho el triple.
          const orig = pr.original_price ? Number(pr.original_price) : undefined;
          const current = {
            id: pr.id,
            price,
            originalPrice: orig && orig > price && orig <= price * 3 ? orig : undefined,
            store: chainName,
            storeName: chainName,
            store_id: branch.id,
            distance: branch.distance,
            updated: pr.last_updated || "",
          };
          let entry = byProduct.get(pr.products.id);
          if (!entry) {
            entry = { info: pr.products, chains: new Map() };
            byProduct.set(pr.products.id, entry);
          }
          const prev = entry.chains.get(chainName);
          if (!prev || current.updated > prev.updated) entry.chains.set(chainName, current);
        }

        const mapped: Product[] = [...byProduct.values()].map(({ info, chains }) => {
          const prices: PriceComparison[] = [...chains.values()]
            .map(({ updated: _updated, ...p }) => p)
            .sort((a, b) => a.price - b.price);
          const bestPrice = prices[0]?.price;
          let savingsPercentage = 0;
          if (prices.length > 1) {
            const highest = prices[prices.length - 1].price;
            if (highest > 0 && bestPrice) savingsPercentage = Math.round(((highest - bestPrice) / highest) * 100);
          }
          return {
            id: info.id,
            name: info.name,
            image: info.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80",
            image_url: info.image_url || undefined,
            category: info.categories?.name || "Almacén",
            ean: info.ean || undefined,
            prices,
            bestPrice,
            savingsPercentage,
          };
        });

        // Primero los que se pueden comparar en más cadenas. (No se ordena por % de ahorro porque
        // hay precios mal cargados por el scraper, ej. $0,89 por una gaseosa, que quedarían arriba.)
        mapped.sort((a, b) => b.prices.length - a.prices.length || a.name.localeCompare(b.name, "es"));

        if (!stale) setProducts(mapped);
      } catch (err) {
        if (stale) return;
        console.error("Error cargando productos:", err);
        setError(err);
      } finally {
        if (!stale) setLoading(false);
      }
    };

    fetchProducts();
    return () => {
      stale = true;
    };
    // nearbyStores cambia de identidad en cada carga; storesKey evita recargar si son las mismas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, categoryId, storesKey, enabled]);

  return {
    data: products,
    products,
    isLoading: loading,
    loading,
    error,
  };
};
