import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AppNotification {
  id: string;
  product_id: string | null;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

// Avisos de la cuenta (los crea el script diario de alertas).
export const useNotifications = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    // Si la tabla todavía no existe, simplemente no hay avisos.
    retry: false,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, product_id, title, body, created_at, read_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return (data || []) as AppNotification[];
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return {
    notifications,
    isLoading,
    unread: notifications.filter((n) => !n.read_at).length,
    markAllRead: () => markAllRead.mutate(),
    removeNotification: (id: string) => remove.mutate(id),
  };
};
