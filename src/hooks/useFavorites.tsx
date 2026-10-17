import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export const useFavorites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", user.id);

      if (error) throw error;

      return data.map((f) => f.product_id);
    },
    enabled: !!user,
  });

  const addFavorite = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Debes iniciar sesión");

      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, product_id: productId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast.success("Agregado a favoritos");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Debes iniciar sesión");

      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast.success("Eliminado de favoritos");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleFavorite = (productId: string) => {
    if (!user) {
      toast.error("Debes iniciar sesión para agregar favoritos");
      return;
    }

    if (favorites.includes(productId)) {
      removeFavorite.mutate(productId);
    } else {
      addFavorite.mutate(productId);
    }
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  return {
    favorites,
    isLoading,
    toggleFavorite,
    isFavorite,
  };
};
