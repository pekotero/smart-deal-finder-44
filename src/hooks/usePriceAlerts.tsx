import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PriceAlert {
  product_id: string;
  base_price: number;
  created_at: string;
}

// Alertas de precio del usuario: "avisame si baja" guarda el mejor precio de ese momento.
export const usePriceAlerts = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: alerts = [], isLoading, isError } = useQuery({
    queryKey: ["price_alerts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_alerts")
        .select("product_id, base_price, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((a) => ({ ...a, base_price: Number(a.base_price) })) as PriceAlert[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ productId, price }: { productId: string; price: number }) => {
      if (!user) throw new Error("Iniciá sesión para crear alertas de precio");
      if (alerts.some((a) => a.product_id === productId)) {
        const { error } = await supabase.from("price_alerts").delete().eq("user_id", user.id).eq("product_id", productId);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from("price_alerts").insert({ user_id: user.id, product_id: productId, base_price: price });
      if (error) throw error;
      return true;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["price_alerts"] });
      toast.success(created ? "Te avisamos acá cuando baje" : "Alerta quitada");
    },
    onError: (e: Error) => toast.error(/price_alerts/.test(e.message) ? "Las alertas todavía no están activadas" : e.message),
  });

  return {
    alerts,
    isLoading,
    isError,
    hasAlert: (productId: string) => alerts.some((a) => a.product_id === productId),
    toggleAlert: (productId: string, price: number) => toggle.mutate({ productId, price }),
  };
};
