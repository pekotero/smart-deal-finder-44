import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pickPrices, priceSources, type SourceStore } from "@/lib/price-pick";

export { chainOf, isOnlineChain } from "@/lib/chains";

export interface PriceComparison {
  id: string;
  price: number;
  originalPrice?: number;
  store: string;
  storeName: string;
  store_id?: string;
  distance?: number;
  // Tienda online (PedidosYa).
  online?: boolean;
  // Precio de esa sucursal (SEPA), no el online de la cadena.
  local?: boolean;
  address?: string;
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
  // Tiendas cercanas al usuario (las de useStores): de ellas salen los precios de cada sucursal y
  // la sucursal donde se muestra el precio online de cada cadena (ver lib/price-pick).
  nearbyStores?: SourceStore[];
  // Sólo estos productos (favoritos).
  productIds?: string[] | null;
  // false mientras se esperan la ubicación y las tiendas cercanas.
  enabled?: boolean;
}

// Productos por página que trae la base.
const PAGE = 60;

// Tiendas con los precios online de cada cadena (son pocas y no cambian: se piden una vez).
let onlineSources: Promise<SourceStore[]> | null = null;
export function getOnlineSources() {
  onlineSources ??= (async () => {
    const { data, error } = await supabase.from("stores").select("id, name, price_source").eq("price_source", "online");
    if (error) {
      onlineSources = null;
      throw error;
    }
    return data || [];
  })();
  return onlineSources;
}

interface SearchRow {
  id: string;
  name: string;
  image_url: string | null;
  ean: string | null;
  category_name: string | null;
  prices: { id: string; store_id: string; price: number; original_price: number | null; last_updated: string | null }[] | null;
  total: number;
}

export const useProducts = (
  optsOrSearchQuery?: UseProductsOptions | string | null,
  categoryParam?: string | null
) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  let searchQuery = "";
  let categoryId = "all";
  let nearbyStores: SourceStore[] = [];
  let productIds: string[] | null = null;
  let enabled = true;

  if (typeof optsOrSearchQuery === "object" && optsOrSearchQuery !== null) {
    searchQuery = optsOrSearchQuery.searchQuery || "";
    categoryId = optsOrSearchQuery.categoryId || "all";
    nearbyStores = optsOrSearchQuery.nearbyStores ?? [];
    productIds = optsOrSearchQuery.productIds ?? null;
    enabled = optsOrSearchQuery.enabled ?? true;
  } else {
    searchQuery = typeof optsOrSearchQuery === "string" ? optsOrSearchQuery : "";
    categoryId = categoryParam || "all";
  }

  const storesKey = nearbyStores.map((s) => `${s.id}:${s.distance ?? ""}`).join(",");
  const idsKey = productIds ? productIds.join(",") : "";
  // Cada búsqueda nueva invalida las páginas que estén llegando de la anterior.
  const generation = useRef(0);
  const query = useRef<{ fetchPage: (off: number) => Promise<{ items: Product[]; total: number }> } | null>(null);
  // Offset de la próxima página, en filas de la base (alguna puede no quedar si no tiene precio cerca).
  const offsetRef = useRef(PAGE);

  useEffect(() => {
    if (!enabled) return;
    const gen = ++generation.current;

    const fetchPage = async (off: number) => {
      const sources = priceSources(nearbyStores, await getOnlineSources());
      if (!sources.size || (productIds && !productIds.length)) return { items: [], total: 0 };
      const cat = categoryId && categoryId !== "all" && categoryId !== "Todas" ? categoryId : null;
      const { data, error: rpcErr } = await supabase.rpc("search_products", {
        store_ids: [...sources.keys()],
        q: searchQuery.trim() || null,
        cat,
        product_ids: productIds,
        lim: PAGE,
        off,
      });
      if (rpcErr) throw rpcErr;
      const rows = (data || []) as unknown as SearchRow[];
      const items: Product[] = [];
      for (const r of rows) {
        const prices = pickPrices(r.prices || [], sources);
        if (!prices.length) continue;
        const bestPrice = prices[0].price;
        const highest = prices[prices.length - 1].price;
        items.push({
          id: r.id,
          name: r.name,
          image: r.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80",
          image_url: r.image_url || undefined,
          category: r.category_name || "Almacén",
          ean: r.ean || undefined,
          prices,
          bestPrice,
          savingsPercentage: prices.length > 1 && highest > 0 ? Math.round(((highest - bestPrice) / highest) * 100) : 0,
        });
      }
      return { items, total: Number(rows[0]?.total ?? 0) };
    };
    query.current = { fetchPage };
    offsetRef.current = PAGE;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { items, total: t } = await fetchPage(0);
        if (gen !== generation.current) return;
        setProducts(items);
        setTotal(t);
      } catch (err) {
        if (gen !== generation.current) return;
        console.error("Error cargando productos:", err);
        setError(err);
        setProducts([]);
        setTotal(0);
      } finally {
        if (gen === generation.current) setLoading(false);
      }
    })();
    // nearbyStores cambia de identidad en cada carga; storesKey evita recargar si son las mismas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, categoryId, storesKey, idsKey, enabled]);

  // Trae la página siguiente y la suma al final.
  const loadMore = useCallback(async () => {
    if (!query.current || loadingMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    try {
      const { items } = await query.current.fetchPage(offsetRef.current);
      if (gen !== generation.current) return;
      offsetRef.current += PAGE;
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...items.filter((p) => !seen.has(p.id))];
      });
    } catch (err) {
      console.error("Error cargando más productos:", err);
    } finally {
      if (gen === generation.current) setLoadingMore(false);
    }
  }, [loadingMore]);
  return {
    data: products,
    products,
    total,
    hasMore: !loading && offsetRef.current < total,
    loadMore,
    loadingMore,
    isLoading: loading,
    loading,
    error,
  };
};
