import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type StoreRow = Tables<"stores">;

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
  // false mientras se espera la ubicación, para no bajar todas las tiendas del país.
  enabled?: boolean;
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
    if (options?.enabled === false) return;
    // Si cambian la ubicación o la ciudad mientras se carga, la respuesta vieja se descarta.
    let stale = false;
    const fetchStores = async () => {
      try {
        setIsLoading(true);
        const lat = options?.userLatitude;
        const lng = options?.userLongitude;
        const hasGps = typeof lat === "number" && typeof lng === "number";
        const radius = options?.maxDistanceKm ?? 30;

        // Supabase devuelve como máximo 1000 filas por consulta y hay miles de tiendas:
        // se piden sólo las del recuadro alrededor del usuario y se pagina.
        const PAGE = 1000;
        const MAX_PAGES = 10;
        const storesData: StoreRow[] = [];
        for (let page = 0; page < MAX_PAGES; page++) {
          let query = supabase.from("stores").select("*");
          // Con una ciudad elegida se muestra esa ciudad; si no, el radio alrededor del usuario.
          if (options?.cityId) query = query.eq("city_id", options.cityId);
          else if (hasGps) {
            const dLat = radius / 111;
            const dLng = radius / (111 * Math.cos((lat * Math.PI) / 180));
            query = query
              .gte("latitude", lat - dLat)
              .lte("latitude", lat + dLat)
              .gte("longitude", lng - dLng)
              .lte("longitude", lng + dLng);
          }
          const { data: chunk, error: storesError } = await query
            .order("id")
            .range(page * PAGE, page * PAGE + PAGE - 1);
          if (storesError) throw storesError;
          storesData.push(...(chunk || []));
          if (!chunk || chunk.length < PAGE) break;
        }

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
        if (!options?.cityId && options?.maxDistanceKm && typeof options?.userLatitude === "number" && typeof options?.userLongitude === "number") {
          processedStores = processedStores.filter(
            (s) => s.distance === undefined || s.distance <= options.maxDistanceKm!
          );
        }

        // Ordenar por cercanía
        processedStores.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

        if (stale) return;
        setData(processedStores);
      } catch (err) {
        if (stale) return;
        console.error("Error al cargar tiendas:", err);
        setError(err);
      } finally {
        if (!stale) setIsLoading(false);
      }
    };

    fetchStores();
    return () => {
      stale = true;
    };
  }, [options?.userLatitude, options?.userLongitude, options?.maxDistanceKm, options?.cityId, options?.enabled]);

  return { data, isLoading, error };
};