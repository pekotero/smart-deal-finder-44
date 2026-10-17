import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateDistanceKm } from "@/hooks/useGeolocation";

export interface Store {
  id: string;
  name: string;
  logo: string;
  address: string;
  rating: number;
  distance: string;
  isOpen: boolean;
  productsCount: number;
  latitude: number | null;
  longitude: number | null;
  calculatedDistanceKm?: number;
}

interface UseStoresOptions {
  userLatitude?: number | null;
  userLongitude?: number | null;
  maxDistanceKm?: number;
  cityId?: string | null;
}

export const useStores = (options?: UseStoresOptions) => {
  const { userLatitude, userLongitude, maxDistanceKm = 500, cityId } = options || {};

  return useQuery({
    queryKey: ["stores", userLatitude, userLongitude, maxDistanceKm, cityId],
    queryFn: async () => {
      let query = supabase
        .from("stores")
        .select("*")
        .order("rating", { ascending: false });

      if (cityId) {
        query = query.eq("city_id", cityId);
      }

      const { data, error } = await query;

      if (error) throw error;

      let stores: Store[] = (data || []).map((store) => {
        const lat = store.latitude ? Number(store.latitude) : null;
        const lng = store.longitude ? Number(store.longitude) : null;
        
        // Calculate real distance if user location is available
        let calculatedDistanceKm: number | undefined;
        let distanceString = "Online";
        
        if (userLatitude && userLongitude && lat && lng) {
          calculatedDistanceKm = calculateDistanceKm(
            userLatitude,
            userLongitude,
            lat,
            lng
          );
          distanceString = `${calculatedDistanceKm.toFixed(1)} km`;
        } else if (lat && lng) {
          distanceString = "Ubicación disponible";
        }

        return {
          id: store.id,
          name: store.name,
          logo: store.logo_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop",
          address: store.address || "Dirección no disponible",
          rating: Number(store.rating) || 4.0,
          distance: distanceString,
          isOpen: store.is_open ?? true,
          productsCount: store.products_count || 0,
          latitude: lat,
          longitude: lng,
          calculatedDistanceKm,
        };
      });

      // If user location is available, filter and sort by distance
      if (userLatitude && userLongitude) {
        stores = stores
          .filter((store) => {
            // Include online stores (no location)
            if (!store.latitude || !store.longitude) return true;
            // Include stores within max distance
            return store.calculatedDistanceKm !== undefined && 
                   store.calculatedDistanceKm <= maxDistanceKm;
          })
          .sort((a, b) => {
            // Online stores go to the end
            if (!a.calculatedDistanceKm) return 1;
            if (!b.calculatedDistanceKm) return -1;
            return a.calculatedDistanceKm - b.calculatedDistanceKm;
          });
      }

      return stores;
    },
  });
};
