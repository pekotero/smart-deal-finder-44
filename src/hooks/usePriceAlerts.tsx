import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AlertKind, AlertRule } from "@/lib/alerts";

export interface PriceAlert extends AlertRule {
  product_id: string;
  created_at: string;
  notified_at?: string | null;
  store_ids?: string[] | null;
}

export interface AlertInput {
  productId: string;
  basePrice: number;
  kind: AlertKind;
  targetPrice?: number;
  percent?: number;
  storeIds?: string[];
}

const num = (v: unknown) => (v == null ? null : Number(v));

// Alertas de precio del usuario. Guardan el mejor precio del momento y la regla: cualquier baja,
// un precio objetivo o un porcentaje. Un script revisa los precios todos los días y avisa.
export const usePriceAlerts = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: alerts = [], isLoading, isError } = useQuery({
    queryKey: ["price_alerts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_alerts")
        .select("product_id, base_price, kind, target_price, percent, notified_price, notified_at, store_ids, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((a) => ({
        ...a,
        kind: (a.kind || "any") as AlertKind,
        base_price: Number(a.base_price),
        target_price: num(a.target_price),
        notified_price: num(a.notified_price),
      })) as PriceAlert[];
    },
  });

  const onError = (e: Error) =>
    toast.error(/price_alerts|column|kind/.test(e.message) ? "Las alertas todavía no están activadas" : e.message);
  const refresh = () => qc.invalidateQueries({ queryKey: ["price_alerts"] });

  const save = useMutation({
    mutationFn: async (a: AlertInput) => {
      if (!user) throw new Error("Iniciá sesión para crear alertas de precio");
      const { error } = await supabase.from("price_alerts").upsert(
        {
          user_id: user.id,
          product_id: a.productId,
          base_price: a.basePrice,
          kind: a.kind,
          target_price: a.kind === "target" ? a.targetPrice ?? null : null,
          percent: a.kind === "percent" ? a.percent ?? null : null,
          store_ids: a.storeIds?.length ? [...new Set(a.storeIds)] : null,
          // Regla nueva: se vuelve a avisar desde cero.
          notified_price: null,
          notified_at: null,
        },
        { onConflict: "user_id,product_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Listo, te avisamos cuando se cumpla");
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) return;
      const { error } = await supabase.from("price_alerts").delete().eq("user_id", user.id).eq("product_id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Alerta quitada");
    },
    onError,
  });

  return {
    alerts,
    isLoading,
    isError,
    saving: save.isPending,
    getAlert: (productId: string) => alerts.find((a) => a.product_id === productId),
    hasAlert: (productId: string) => alerts.some((a) => a.product_id === productId),
    saveAlert: (a: AlertInput) => save.mutateAsync(a),
    removeAlert: (productId: string) => remove.mutate(productId),
  };
};
