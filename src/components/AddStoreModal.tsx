import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Loader2, MapPin, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";

interface AddStoreModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddStoreModal = ({ onClose, onSuccess }: AddStoreModalProps) => {
  const { user } = useAuth();
  const { latitude, longitude } = useGeolocation();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);

  // Fetch cities
  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, province")
        .order("name");
      if (error) throw error;
      return data;
    },
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

  const addStoreMutation = useMutation({
    mutationFn: async () => {
      if (!user || !isVerified) throw new Error("No autorizado");

      const storeData: any = {
        name,
        address,
        city_id: selectedCityId || null,
      };

      if (useCurrentLocation && latitude && longitude) {
        storeData.latitude = latitude;
        storeData.longitude = longitude;
      }

      const { error } = await supabase.from("stores").insert(storeData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("¡Tienda agregada exitosamente!");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al agregar tienda");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    addStoreMutation.mutate();
  };

  if (!isVerified) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">No autorizado</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-muted-foreground text-center py-4">
            Solo usuarios verificados pueden agregar tiendas.
            Verifica tu email para obtener acceso.
          </p>
          <Button variant="outline" className="w-full" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold">Nueva tienda</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="storeName">Nombre de la tienda *</Label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="storeName"
                placeholder="Ej: Carrefour Centro"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label>Ciudad</Label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {cities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => setSelectedCityId(city.id)}
                  className={`p-2 rounded-lg border text-left text-sm transition-all ${
                    selectedCityId === city.id
                      ? "border-primary bg-primary-light"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium">{city.name}</p>
                  <p className="text-xs text-muted-foreground">{city.province}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="storeAddress">Dirección</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="storeAddress"
                placeholder="Ej: Av. Pellegrini 1234"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Use current location */}
          {latitude && longitude && (
            <label className="flex items-center gap-3 p-3 bg-secondary rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={useCurrentLocation}
                onChange={(e) => setUseCurrentLocation(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <div>
                <p className="text-sm font-medium">Usar mi ubicación actual</p>
                <p className="text-xs text-muted-foreground">
                  La tienda aparecerá en el mapa
                </p>
              </div>
            </label>
          )}

          <Button
            type="submit"
            variant="action"
            className="w-full"
            disabled={addStoreMutation.isPending}
          >
            {addStoreMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Agregar tienda"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AddStoreModal;
