import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Package, DollarSign, Store, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface AddProductModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddProductModal = ({ onClose, onSuccess }: AddProductModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canAddProduct, remainingProducts, productLimit } = useSubscription();

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addProductMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Debes iniciar sesión");
      if (!canAddProduct) throw new Error("Has alcanzado el límite de productos");

      // First create the product
      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          name,
          brand: brand || null,
          description: description || null,
          category_id: categoryId || null,
          store_id: storeId || null,
          contributed_by: user.id,
          is_user_contributed: true,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Then add the price if provided
      if (price && storeId) {
        const { error: priceError } = await supabase.from("prices").insert({
          product_id: product.id,
          store_id: storeId,
          price: parseFloat(price),
          original_price: originalPrice ? parseFloat(originalPrice) : null,
          contributed_by: user.id,
        });

        if (priceError) {
          console.error("Error adding price:", priceError);
          // Don't fail the whole operation if price fails
        }
      }

      return product;
    },
    onSuccess: () => {
      toast.success("¡Producto publicado exitosamente!");
      queryClient.invalidateQueries({ queryKey: ["userProductCount"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["userProducts"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al publicar producto");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre del producto es requerido");
      return;
    }
    addProductMutation.mutate();
  };

  if (!canAddProduct) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Límite alcanzado</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-muted-foreground mb-4">
              Has alcanzado el límite de{" "}
              <strong>{productLimit === -1 ? "∞" : productLimit}</strong> productos
              de tu plan actual.
            </p>
            <Link to="/subscriptions">
              <Button className="w-full">Ver planes de suscripción</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <div>
            <h2 className="text-xl font-bold">Publicar producto</h2>
            {remainingProducts !== Infinity && (
              <p className="text-sm text-muted-foreground">
                {remainingProducts} productos restantes
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="productName">Nombre del producto *</Label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="productName"
                placeholder="Ej: Leche entera 1L"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label htmlFor="brand">Marca</Label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="brand"
                placeholder="Ej: La Serenísima"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Store */}
          <div className="space-y-2">
            <Label>Tienda / Comercio</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger>
                <Store className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Seleccionar tienda" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="price">Precio actual</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="originalPrice">Precio original</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="originalPrice"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Descripción opcional del producto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={addProductMutation.isPending}
          >
            {addProductMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publicando...
              </>
            ) : (
              "Publicar producto"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;
