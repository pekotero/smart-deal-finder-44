import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface City {
  id: string;
  name: string;
  province: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export const useCities = () => {
  return useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .order("name");

      if (error) throw error;

      return (data || []).map((city) => ({
        id: city.id,
        name: city.name,
        province: city.province,
        country: city.country,
        latitude: city.latitude ? Number(city.latitude) : null,
        longitude: city.longitude ? Number(city.longitude) : null,
      })) as City[];
    },
  });
};
