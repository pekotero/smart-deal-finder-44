import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SubscriptionPlan {
  id: string;
  tier: "free" | "emprendedor" | "negocio" | "empresa";
  name: string;
  description: string | null;
  max_products: number;
  price_monthly: number;
  featured_visibility: boolean;
  priority_in_search: number;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  plan?: SubscriptionPlan;
}

export const useSubscription = () => {
  const { user } = useAuth();

  // Obtener todos los planes disponibles
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["subscriptionPlans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_monthly", { ascending: true });
      
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Obtener suscripción del usuario
  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["userSubscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      
      if (error) throw error;
      return data as (UserSubscription & { plan: SubscriptionPlan }) | null;
    },
    enabled: !!user,
  });

  // Obtener conteo de productos del usuario
  const { data: productCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ["userProductCount", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase.rpc("get_user_product_count", {
        _user_id: user.id,
      });
      if (error) return 0;
      return data as number;
    },
    enabled: !!user,
  });

  // Obtener límite de productos
  const { data: productLimit = 5, isLoading: limitLoading } = useQuery({
    queryKey: ["userProductLimit", user?.id],
    queryFn: async () => {
      if (!user) return 5;
      const { data, error } = await supabase.rpc("get_user_product_limit", {
        _user_id: user.id,
      });
      if (error) return 5;
      return data as number;
    },
    enabled: !!user,
  });

  // Plan actual del usuario
  const currentPlan = userSubscription?.plan || plans.find(p => p.tier === "free");
  
  // Verificar si puede agregar productos
  const canAddProduct = productLimit === -1 || productCount < productLimit;
  
  // Productos restantes
  const remainingProducts = productLimit === -1 ? Infinity : Math.max(0, productLimit - productCount);

  // Verificar si tiene visibilidad destacada
  const hasFeaturedVisibility = currentPlan?.featured_visibility || false;

  return {
    plans,
    userSubscription,
    currentPlan,
    productCount,
    productLimit,
    canAddProduct,
    remainingProducts,
    hasFeaturedVisibility,
    isLoading: plansLoading || subscriptionLoading || countLoading || limitLoading,
  };
};
