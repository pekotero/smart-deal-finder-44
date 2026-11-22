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
  // false mientras se espera la ubicación, para no bajar precios de todo el país.
  enabled?: boolean;
}

interface PriceRow {
  id: string;
  price: number;
  original_price: number | null;
  store_id: string;
  stores: { id: string; name: string; latitude: number | null; longitude: number | null; city_id: string | null };
  products: {
    id: string;
    name: string;
    image_url: string | null;
    ean: string | null;
    category_id: string | null;
    categories: { name: string } | null;
  };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const chainOf = (storeName: string) => {
  const lower = storeName.toLowerCase();
  if (lower.includes("coto")) return "Coto";
  if (lower.includes("carrefour")) return "Carrefour";
  if (lower.includes("jumbo")) return "Jumbo";
  if (lower.includes("gallega")) return "La Gallega";
  if (lower.includes("reina")) return "La Reina";
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
  let userLatitude: number | null = null;
  let userLongitude: number | null = null;
  let maxDistanceKm = 30;
  let cityId: string | null = null;
  let enabled = true;

  if (typeof optsOrSearchQuery === "object" && optsOrSearchQuery !== null) {
    searchQuery = optsOrSearchQuery.searchQuery || "";
    categoryId = optsOrSearchQuery.categoryId || "all";
    userLatitude = optsOrSearchQuery.userLatitude ?? null;
    userLongitude = optsOrSearchQuery.userLongitude ?? null;
    maxDistanceKm = optsOrSearchQuery.maxDistanceKm ?? 30;
    cityId = optsOrSearchQuery.cityId ?? null;
    enabled = optsOrSearchQuery.enabled ?? true;
  } else {
    searchQuery = typeof optsOrSearchQuery === "string" ? optsOrSearchQuery : "";
    categoryId = categoryParam || "all";
  }

  useEffect(() => {
    if (!enabled) return;
    // Si cambian los filtros mientras se carga, la respuesta vieja se descarta.
    let stale = false;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const hasGps = typeof userLatitude === "number" && typeof userLongitude === "number";

        // Se parte de los precios (no de los productos) para traer sólo los de tiendas cercanas,
        // y se pagina porque Supabase devuelve como máximo 1000 filas por consulta.
        const rows: PriceRow[] = [];
        for (let page = 0; page < MAX_PAGES; page++) {
          let query = supabase
            .from("prices")
            .select(
              "id, price, original_price, store_id, stores!inner(id, name, latitude, longitude, city_id), products!inner(id, name, image_url, ean, category_id, categories(name))",
            );
          if (hasGps) {
            const dLat = maxDistanceKm / 111;
            const dLng = maxDistanceKm / (111 * Math.cos((userLatitude! * Math.PI) / 180));
            query = query
              .gte("stores.latitude", userLatitude! - dLat)
              .lte("stores.latitude", userLatitude! + dLat)
              .gte("stores.longitude", userLongitude! - dLng)
              .lte("stores.longitude", userLongitude! + dLng);
          }
          if (cityId) query = query.eq("stores.city_id", cityId);
          if (categoryId && categoryId !== "all" && categoryId !== "Todas") {
            query = query.eq("products.category_id", categoryId);
          }
          if (searchQuery.trim()) query = query.ilike("products.name", `%${searchQuery.trim()}%`);

          const { data, error: fetchErr } = await query.order("id").range(page * PAGE, page * PAGE + PAGE - 1);
          if (fetchErr) throw fetchErr;
          rows.push(...((data || []) as unknown as PriceRow[]));
          if (!data || data.length < PAGE) break;
        }

        // Agrupar por producto, quedándose con el precio más barato de cada cadena.
        const byProduct = new Map<string, { info: PriceRow["products"]; chains: Map<string, PriceComparison> }>();
        for (const pr of rows) {
          const store = pr.stores;
          let dist: number | undefined;
          if (hasGps && typeof store.latitude === "number" && typeof store.longitude === "number") {
            dist = calculateDistance(userLatitude!, userLongitude!, store.latitude, store.longitude);
            if (dist > maxDistanceKm) continue; // el recuadro es más grande que el círculo
          }
          const chainName = chainOf(store.name || "Supermercado");
          const current: PriceComparison = {
            id: pr.id,
            price: Number(pr.price),
            originalPrice: pr.original_price ? Number(pr.original_price) : undefined,
            store: chainName,
            storeName: chainName,
            store_id: pr.store_id,
            distance: dist,
          };
          let entry = byProduct.get(pr.products.id);
          if (!entry) {
            entry = { info: pr.products, chains: new Map() };
            byProduct.set(pr.products.id, entry);
          }
          const prev = entry.chains.get(chainName);
          if (!prev || current.price < prev.price) entry.chains.set(chainName, current);
        }

        const mapped: Product[] = [...byProduct.values()].map(({ info, chains }) => {
          const prices = [...chains.values()].sort((a, b) => a.price - b.price);
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

        // Primero los que más se ahorra comparando cadenas.
        mapped.sort((a, b) => (b.savingsPercentage ?? 0) - (a.savingsPercentage ?? 0) || b.prices.length - a.prices.length);

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
  }, [searchQuery, categoryId, userLatitude, userLongitude, maxDistanceKm, cityId, enabled]);

  return {
    data: products,
    products,
    isLoading: loading,
    loading,
    error,
  };
};
