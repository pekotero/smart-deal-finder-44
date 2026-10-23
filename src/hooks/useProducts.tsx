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

export const useProducts = (
  optsOrSearchQuery?: UseProductsOptions | string | null,
  categoryParam?: string | null
) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  let searchQuery = "";
  let categoryId = "all";
  let userLatitude: number | null = null;
  let userLongitude: number | null = null;

  if (typeof optsOrSearchQuery === "object" && optsOrSearchQuery !== null) {
    searchQuery = optsOrSearchQuery.searchQuery || "";
    categoryId = optsOrSearchQuery.categoryId || "all";
    userLatitude = optsOrSearchQuery.userLatitude ?? null;
    userLongitude = optsOrSearchQuery.userLongitude ?? null;
  } else {
    searchQuery = typeof optsOrSearchQuery === "string" ? optsOrSearchQuery : "";
    categoryId = categoryParam || "all";
  }

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);

        const { data: rawProducts, error: fetchErr } = await supabase
          .from("products")
          .select("*, prices(*, stores(*))");

        if (fetchErr) throw fetchErr;

        let mapped: Product[] = (rawProducts || []).map((p: any) => {
          const rawPrices = p.prices || [];
          const chainPriceMap = new Map<string, PriceComparison>();

          rawPrices.forEach((pr: any) => {
            const storeObj = pr.stores || {};
            const storeName = storeObj.name || "Supermercado";
            
            let chainName = "Supermercado";
            const lower = storeName.toLowerCase();
            if (lower.includes("coto")) chainName = "Coto";
            else if (lower.includes("carrefour")) chainName = "Carrefour";
            else if (lower.includes("jumbo")) chainName = "Jumbo";
            else if (lower.includes("gallega")) chainName = "La Gallega";
            else if (lower.includes("reina")) chainName = "La Reina";
            else chainName = storeName;

            let dist: number | undefined = undefined;
            if (
              typeof userLatitude === "number" &&
              typeof userLongitude === "number" &&
              typeof storeObj.latitude === "number" &&
              typeof storeObj.longitude === "number"
            ) {
              dist = calculateDistance(userLatitude, userLongitude, storeObj.latitude, storeObj.longitude);
            }

            const currentPrice: PriceComparison = {
              id: pr.id,
              price: Number(pr.price),
              originalPrice: pr.original_price ? Number(pr.original_price) : undefined,
              store: chainName,
              storeName: chainName,
              store_id: pr.store_id,
              distance: dist
            };

            if (!chainPriceMap.has(chainName) || currentPrice.price < chainPriceMap.get(chainName)!.price) {
              chainPriceMap.set(chainName, currentPrice);
            }
          });

          const deduplicatedPrices = Array.from(chainPriceMap.values()).sort((a, b) => a.price - b.price);

          let bestPrice = deduplicatedPrices.length > 0 ? deduplicatedPrices[0].price : undefined;
          let savingsPercentage = 0;

          if (deduplicatedPrices.length > 1) {
            const highestPrice = deduplicatedPrices[deduplicatedPrices.length - 1].price;
            if (highestPrice > 0 && bestPrice) {
              savingsPercentage = Math.round(((highestPrice - bestPrice) / highestPrice) * 100);
            }
          }

          return {
            id: p.id,
            name: p.name,
            image: p.image_url || p.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80",
            image_url: p.image_url || p.image,
            category: p.category || "Almacén",
            ean: p.ean,
            prices: deduplicatedPrices,
            bestPrice,
            savingsPercentage
          };
        });

        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase().trim();
          mapped = mapped.filter((p) => p.name.toLowerCase().includes(q));
        }

        if (categoryId && categoryId !== "all" && categoryId !== "Todas") {
          mapped = mapped.filter((p) => p.category.toLowerCase() === categoryId.toLowerCase());
        }

        setProducts(mapped);
      } catch (err: any) {
        console.error("Error cargando productos:", err.message);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [searchQuery, categoryId, userLatitude, userLongitude]);

  return {
    data: products,
    products,
    isLoading: loading,
    loading,
    error
  };
};
