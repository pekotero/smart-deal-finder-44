import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useUserRole = () => {
  const { user } = useAuth();

  const { data: isVerified = false, isLoading: isVerifiedLoading } = useQuery({
    queryKey: ["isVerified", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("is_verified_user", {
        _user_id: user.id,
      });
      if (error) return false;
      return data as boolean;
    },
    enabled: !!user,
  });

  const { data: contributionCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ["contributionCount", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase.rpc("get_user_contribution_count", {
        _user_id: user.id,
      });
      if (error) return 0;
      return data as number;
    },
    enabled: !!user,
  });

  const canAddPrices = user && (isVerified || contributionCount < 5);
  const canAddStores = user && isVerified;
  const remainingFreeContributions = Math.max(0, 5 - contributionCount);

  return {
    isVerified,
    contributionCount,
    canAddPrices,
    canAddStores,
    remainingFreeContributions,
    isLoading: isVerifiedLoading || countLoading,
  };
};
