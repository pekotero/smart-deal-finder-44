import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Loader2, Store, DollarSign, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AddStoreModal from "./AddStoreModal";

interface AddPriceModalProps {
  productId: string;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AddPriceModal = ({ productId, productName, onClose, onSuccess }: AddPriceModalProps) => {
  const { user } = useAuth();
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [showAddStore, setShowAddStore] = useState(false);

  // Check user contribution count
  const { data: contributionCount = 0 } = useQuery({
    queryKey: ["contributionCount", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase.rpc("get_user_contribution_count", {
        _user_id: user.id,
      });
      if (error) throw error;
      return data as number;
    },
    enabled: !!user,
  });

  // Check if user is verified
  const { data: isVerified = false } = useQuery({
    queryKey: ["isVerified", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("is_verified_user", {
        _user_id: user.id,
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
  });

  // Fetch stores
  const { data: stores = [], refetch: refetchStores } = useQuery({
    queryKey: ["stores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, logo_url")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch user profile for name
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const canAddPrice = isVerified || contributionCount < 5;
  const remainingFree = 5 - contributionCount;

  const addPriceMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No autenticado");
      
      const { error } = await supabase.from("prices").insert({
        product_id: productId,
        store_id: selectedStoreId,
        price: Number(price),
        original_price: originalPrice ? Number(originalPrice) : null,
        contributed_by: user.id,
        contributor_name: profile?.full_name || user.email?.split("@")[0],
        verified: isVerified,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("¡Precio agregado exitosamente!");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al agregar precio");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId || !price) {
      toast.error("Completa todos los campos requeridos");
      return;
    }
    addPriceMutation.mutate();
  };

  if (!canAddPrice) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Límite alcanzado</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="text-center py-6">
            <AlertCircle className="w-12 h-12 text-accent mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Has alcanzado el límite de 5 precios para cuentas no verificadas.
            </p>
            <p className="text-sm text-muted-foreground">
              Verifica tu cuenta confirmando tu email para agregar precios ilimitados.
            </p>
          </div>
          
          <Button variant="outline" className="w-full" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-card p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-bold">Agregar precio</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Product info */}
            <div className="p-3 bg-secondary rounded-lg">
              <p className="text-sm text-muted-foreground">Producto</p>
              <p className="font-medium">{productName}</p>
            </div>

            {/* Remaining count for non-verified */}
            {!isVerified && (
              <div className="p-3 bg-accent-light rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-accent" />
                <p className="text-sm">
                  Te quedan <strong>{remainingFree}</strong> precios gratis
                </p>
              </div>
            )}

            {/* Store selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tienda *</Label>
                {isVerified && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowAddStore(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nueva tienda
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setSelectedStoreId(store.id)}
                    className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      selectedStoreId === store.id
                        ? "border-primary bg-primary-light"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={store.logo_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=50"}
                      alt={store.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                    <span className="text-sm truncate">{store.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">Precio actual *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="price"
                  type="number"
                  placeholder="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-10"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            {/* Original price */}
            <div className="space-y-2">
              <Label htmlFor="originalPrice">Precio original (opcional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="originalPrice"
                  type="number"
                  placeholder="Si hay descuento"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  className="pl-10"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="action"
              className="w-full"
              disabled={addPriceMutation.isPending}
            >
              {addPriceMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Agregar precio"
              )}
            </Button>
          </form>
        </div>
      </div>

      {showAddStore && (
        <AddStoreModal
          onClose={() => setShowAddStore(false)}
          onSuccess={() => {
            setShowAddStore(false);
            refetchStores();
          }}
        />
      )}
    </>
  );
};

export default AddPriceModal;
