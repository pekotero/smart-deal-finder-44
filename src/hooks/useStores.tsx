import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Store {
  id: string;
  name: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  distanceKm?: number;
  image_url?: string;
  logo_url?: string;
}

interface UseStoresOptions {
  userLatitude?: number | null;
  userLongitude?: number | null;
  maxDistanceKm?: number;
  cityId?: string | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radio de la Tierra en km
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
};

export const useStores = (options?: UseStoresOptions) => {
  const [data, setData] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        setIsLoading(true);
        let query = supabase.from("stores").select("*");

        if (options?.cityId) {
          query = query.eq("city_id", options.cityId);
        }

        const { data: storesData, error: storesError } = await query;
        if (storesError) throw storesError;

        let processedStores: Store[] = (storesData || []).map((s) => {
          let dist: number | undefined = undefined;
          if (
            typeof options?.userLatitude === "number" &&
            typeof options?.userLongitude === "number" &&
            typeof s.latitude === "number" &&
            typeof s.longitude === "number"
          ) {
            dist = calculateDistance(
              options.userLatitude,
              options.userLongitude,
              s.latitude,
              s.longitude
            );
          }
          return {
            ...s,
            distance: dist,
            distanceKm: dist,
          };
        });

        // Filtrar por distancia máxima solo si hay GPS disponible
        if (options?.maxDistanceKm && typeof options?.userLatitude === "number" && typeof options?.userLongitude === "number") {
          processedStores = processedStores.filter(
            (s) => s.distance === undefined || s.distance <= options.maxDistanceKm!
          );
        }

        // Ordenar por cercanía
        processedStores.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

        setData(processedStores);
      } catch (err) {
        console.error("Error al cargar tiendas:", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStores();
  }, [options?.userLatitude, options?.userLongitude, options?.maxDistanceKm, options?.cityId]);

  return { data, isLoading, error };
};