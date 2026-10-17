import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateDistanceKm } from "@/hooks/useGeolocation";

export interface PriceInfo {
  store: string;
  price: number;
  originalPrice?: number;
  logo: string;
  storeId: string;
  distance?: string;
  distanceKm?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  image: string;
  category: string;
  categoryId: string;
  prices: PriceInfo[];
}

interface UseProductsOptions {
  categoryId?: string;
  searchQuery?: string;
  userLatitude?: number | null;
  userLongitude?: number | null;
  maxDistanceKm?: number;
  cityId?: string | null;
}

export const useProducts = (options?: UseProductsOptions) => {
  const { 
    categoryId, 
    searchQuery, 
    userLatitude, 
    userLongitude, 
    maxDistanceKm = 500,
    cityId,
  } = options || {};

  return useQuery({
    queryKey: ["products", categoryId, searchQuery, userLatitude, userLongitude, maxDistanceKm, cityId],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(`
          id,
          name,
          description,
          image_url,
          category_id,
          categories (
            id,
            name
          ),
          prices (
            id,
            price,
            original_price,
            store_id,
            stores (
              id,
              name,
              logo_url,
              latitude,
              longitude
            )
          )
        `);

      if (categoryId && categoryId !== "all") {
        query = query.eq("category_id", categoryId);
      }

      if (searchQuery && searchQuery.trim()) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const products: Product[] = (data || []).map((product: any) => {
        let prices: PriceInfo[] = (product.prices || [])
          .map((p: any) => {
            const currentPrice = Number(p.price);
            const rawOriginalPrice = p.original_price ? Number(p.original_price) : 0;

            // FILTRO RADICAL: Si el precio tachado es más del doble del actual 
            // o si es mayor a 50.000 para un producto común, lo ignoramos.
            let cleanOriginalPrice: number | undefined = undefined;
            if (rawOriginalPrice > currentPrice && rawOriginalPrice < currentPrice * 2) {
              cleanOriginalPrice = rawOriginalPrice;
            }

            const storeLat = p.stores?.latitude ? Number(p.stores.latitude) : null;
            const storeLng = p.stores?.longitude ? Number(p.stores.longitude) : null;
            
            let distanceKm: number | undefined;
            let distanceString = "Online";
            
            if (userLatitude && userLongitude && storeLat && storeLng) {
              distanceKm = calculateDistanceKm(userLatitude, userLongitude, storeLat, storeLng);
              distanceString = `${distanceKm.toFixed(1)} km`;
            }
            
            return {
              store: p.stores?.name || "Tienda",
              price: currentPrice,
              originalPrice: cleanOriginalPrice, // Pasamos el precio limpio
              logo: p.stores?.logo_url || "",
              storeId: p.store_id,
              distance: distanceString,
              distanceKm,
              storeLat,
              storeLng,
            };
          });

        if (userLatitude && userLongitude) {
          prices = prices.filter((p: any) => {
            if (!p.storeLat || !p.storeLng) return true;
            return p.distanceKm !== undefined && p.distanceKm <= maxDistanceKm;
          });
        }

        // Ordenar por precio
        prices = prices.sort((a, b) => a.price - b.price);

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          image: product.image_url || "",
          category: product.categories?.name || "Sin categoría",
          categoryId: product.category_id,
          prices,
        };
      });

      return products.filter(p => p.prices.length > 0);
    },
    // Esto fuerza a que no use caché viejo y pida datos nuevos
    staleTime: 0,
    gcTime: 0,
  });
};