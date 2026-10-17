import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Package,
  Plus,
  LogOut,
  Crown,
  ChevronRight,
  Loader2,
  Trash2,
  Store,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import AddProductModal from "@/components/AddProductModal";
import { toast } from "sonner";

const Profile = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut, loading: authLoading } = useAuth();
  const {
    currentPlan,
    productCount,
    productLimit,
    canAddProduct,
    remainingProducts,
    hasFeaturedVisibility,
    isLoading: subscriptionLoading,
  } = useSubscription();

  const [showAddProduct, setShowAddProduct] = useState(false);

  // Redirect if not logged in
  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user's products
  const { data: userProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["userProducts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          id,
          name,
          brand,
          image_url,
          created_at,
          category:categories(name),
          store:stores(name)
        `
        )
        .eq("contributed_by", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      toast.error("Error al eliminar producto");
      return;
    }

    toast.success("Producto eliminado");
    queryClient.invalidateQueries({ queryKey: ["userProducts"] });
    queryClient.invalidateQueries({ queryKey: ["userProductCount"] });
  };

  const handleProductSuccess = () => {
    setShowAddProduct(false);
  };

  if (authLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const usagePercentage =
    productLimit === -1 ? 0 : (productCount / productLimit) * 100;

  const tierConfig = {
    free: { color: "bg-muted text-muted-foreground", icon: User },
    emprendedor: { color: "bg-primary/10 text-primary", icon: Store },
    negocio: { color: "bg-accent/10 text-accent", icon: Crown },
    empresa: { color: "bg-gradient-to-r from-primary to-accent text-primary-foreground", icon: Sparkles },
  };

  const currentTier = currentPlan?.tier || "free";
  const TierIcon = tierConfig[currentTier as keyof typeof tierConfig]?.icon || User;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with gradient */}
      <div className="gradient-profile">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-8">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/")}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Inicio
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSignOut}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>

          {/* Profile Header */}
          <div className="flex items-center gap-4 pb-6">
            <div className="w-20 h-20 bg-primary-foreground/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-primary-foreground/30">
              <User className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-primary-foreground">
                {profile?.full_name || user?.email?.split("@")[0]}
              </h1>
              <p className="text-primary-foreground/70 text-sm">{user?.email}</p>
              {hasFeaturedVisibility && (
                <Badge className="mt-2 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">
                  <Crown className="w-3 h-3 mr-1" />
                  Comercio destacado
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container -mt-4 space-y-4">
        {/* Subscription Card */}
        <Card className="glass-card border-0 shadow-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tierConfig[currentTier as keyof typeof tierConfig]?.color || 'bg-muted'}`}>
                  <TierIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plan actual</p>
                  <h3 className="font-bold text-lg capitalize">{currentPlan?.name || "Gratis"}</h3>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/subscriptions")}
                className="rounded-xl"
              >
                {currentTier === "free" ? "Mejorar" : "Ver planes"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Productos publicados</span>
                <span className="font-bold text-lg">
                  {productCount} <span className="text-muted-foreground font-normal text-sm">/ {productLimit === -1 ? "∞" : productLimit}</span>
                </span>
              </div>
              {productLimit !== -1 && (
                <Progress value={usagePercentage} className="h-2.5 rounded-full" />
              )}
              {remainingProducts !== Infinity && remainingProducts <= 2 && (
                <div className="flex items-center gap-2 p-3 bg-accent-light rounded-xl">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <p className="text-sm text-accent font-medium">
                    ¡Solo te quedan {remainingProducts} productos! Mejora tu plan para publicar más.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Product CTA */}
        <Button
          className="w-full h-14 rounded-2xl text-base font-semibold"
          variant="action"
          onClick={() => setShowAddProduct(true)}
          disabled={!canAddProduct}
        >
          <Plus className="w-5 h-5 mr-2" />
          Publicar nuevo producto
        </Button>

        {/* User Products Section */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Mis productos</h2>
            <Badge variant="secondary" className="rounded-full">
              {userProducts.length}
            </Badge>
          </div>

          {productsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : userProducts.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">Sin productos aún</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Publica tu primer producto y comienza a llegar a más clientes
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowAddProduct(true)}
                  className="rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Publicar mi primer producto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {userProducts.map((product, index) => (
                <Card 
                  key={product.id} 
                  className="overflow-hidden hover:shadow-card-hover transition-all duration-300 animate-fade-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-7 h-7 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{product.name}</h4>
                        {product.brand && (
                          <p className="text-sm text-muted-foreground">
                            {product.brand}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {product.category && (
                            <Badge variant="secondary" className="text-xs rounded-full">
                              {product.category.name}
                            </Badge>
                          )}
                          {product.store && (
                            <Badge variant="outline" className="text-xs rounded-full">
                              <Store className="w-3 h-3 mr-1" />
                              {product.store.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onSuccess={handleProductSuccess}
        />
      )}
    </div>
  );
};

export default Profile;
