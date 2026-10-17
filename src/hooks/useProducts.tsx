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

      // Transform the data with location filtering
      const products: Product[] = (data || []).map((product: any) => {
        // Filter and transform prices based on store location
        let prices: PriceInfo[] = (product.prices || [])
          .map((p: any) => {
            const storeLat = p.stores?.latitude ? Number(p.stores.latitude) : null;
            const storeLng = p.stores?.longitude ? Number(p.stores.longitude) : null;
            
            let distanceKm: number | undefined;
            let distanceString = "Online";
            
            if (userLatitude && userLongitude && storeLat && storeLng) {
              distanceKm = calculateDistanceKm(
                userLatitude,
                userLongitude,
                storeLat,
                storeLng
              );
              distanceString = `${distanceKm.toFixed(1)} km`;
            } else if (storeLat && storeLng) {
              distanceString = "Ubicación disponible";
            }
            
            return {
              store: p.stores?.name || "Tienda",
              price: Number(p.price),
              originalPrice: p.original_price ? Number(p.original_price) : undefined,
              logo: p.stores?.logo_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=50&h=50&fit=crop",
              storeId: p.store_id,
              distance: distanceString,
              distanceKm,
              storeLat,
              storeLng,
            };
          });

        // Filter prices by distance if user location is available
        if (userLatitude && userLongitude) {
          prices = prices.filter((p: any) => {
            // Include online stores (no location)
            if (!p.storeLat || !p.storeLng) return true;
            // Include stores within max distance
            return p.distanceKm !== undefined && p.distanceKm <= maxDistanceKm;
          });
        }

        // Sort by price (cheapest first)
        prices = prices
          .map(({ storeLat, storeLng, ...rest }: any) => rest) // Remove internal fields
          .sort((a: PriceInfo, b: PriceInfo) => a.price - b.price);

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          image: product.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop",
          category: product.categories?.name || "Sin categoría",
          categoryId: product.category_id,
          prices,
        };
      });

      // Filter out products that have no prices in nearby stores
      const filteredProducts = userLatitude && userLongitude
        ? products.filter(p => p.prices.length > 0)
        : products;

      return filteredProducts;
    },
  });
};
