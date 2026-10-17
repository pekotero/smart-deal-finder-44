import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw error;

      const categories: Category[] = [
        { id: "all", name: "Todos", icon: "sparkles" },
        ...(data || []).map((cat) => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || "package",
        })),
      ];

      return categories;
    },
  });
};
