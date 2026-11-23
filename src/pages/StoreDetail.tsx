import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  MapPin, 
  Star, 
  Clock,
  Phone,
  Globe,
  Navigation,
  Loader2,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation, calculateDistanceKm } from "@/hooks/useGeolocation";
import { chainOf } from "@/hooks/useProducts";

interface StoreProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
}

interface StoreDetailData {
  id: string;
  name: string;
  logo: string;
  address: string;
  rating: number;
  isOpen: boolean;
  latitude?: number;
  longitude?: number;
  distance?: string;
  cityName?: string;
  products: StoreProduct[];
}

const StoreDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { latitude: userLat, longitude: userLng } = useGeolocation();

  const { data: store, isLoading } = useQuery({
    queryKey: ["store", id, userLat, userLng],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(`
          id,
          name,
          logo_url,
          address,
          rating,
          is_open,
          latitude,
          longitude,
          city_id,
          cities (name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const storeLat = data.latitude ? Number(data.latitude) : undefined;
      const storeLng = data.longitude ? Number(data.longitude) : undefined;
      
      let distanceStr = "Online";
      if (userLat && userLng && storeLat && storeLng) {
        const dist = calculateDistanceKm(userLat, userLng, storeLat, storeLng);
        distanceStr = `${dist.toFixed(1)} km`;
      }

      // Los precios son los online de cada cadena y están guardados en una sola sucursal por
      // cadena: se muestran los de la cadena de esta tienda (el más reciente de cada producto).
      const chain = chainOf(data.name || "");
      const latest = new Map<string, StoreProduct & { updated: string }>();
      for (let page = 0; page < 10; page++) {
        const { data: rows, error: pErr } = await supabase
          .from("prices")
          .select("price, original_price, last_updated, stores!inner(name), products!inner(id, name, image_url)")
          .order("id")
          .range(page * 1000, page * 1000 + 999);
        if (pErr) throw pErr;
        type Row = {
          price: number;
          original_price: number | null;
          last_updated: string | null;
          stores: { name: string } | null;
          products: { id: string; name: string | null; image_url: string | null };
        };
        for (const r of (rows || []) as unknown as Row[]) {
          if (chainOf(r.stores?.name || "") !== chain) continue;
          const price = Number(r.price);
          const orig = r.original_price ? Number(r.original_price) : undefined;
          const item = {
            id: r.products.id,
            name: r.products.name || "Producto",
            image: r.products.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=200",
            price,
            originalPrice: orig && orig > price && orig <= price * 3 ? orig : undefined,
            updated: r.last_updated || "",
          };
          const prev = latest.get(item.id);
          if (!prev || item.updated > prev.updated) latest.set(item.id, item);
        }
        if (!rows || rows.length < 1000) break;
      }
      const products: StoreProduct[] = [...latest.values()]
        .map(({ updated: _u, ...p }) => p)
        .sort((a, b) => a.name.localeCompare(b.name, "es"));

      return {
        id: data.id,
        name: data.name,
        logo: data.logo_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=200",
        address: data.address || "Dirección no disponible",
        rating: Number(data.rating) || 4.0,
        isOpen: data.is_open ?? true,
        latitude: storeLat,
        longitude: storeLng,
        distance: distanceStr,
        cityName: (data.cities as any)?.name,
        products,
      } as StoreDetailData;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">Tienda no encontrada</p>
        <Button onClick={() => navigate("/")}>Volver al inicio</Button>
      </div>
    );
  }

  const openMaps = () => {
    if (store.latitude && store.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`,
        "_blank"
      );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold truncate">{store.name}</h1>
          </div>
        </div>
      </header>

      {/* Store Hero */}
      <section className="bg-gradient-to-b from-primary/10 to-background">
        <div className="container py-8">
          <div className="flex items-start gap-4">
            <img
              src={store.logo}
              alt={store.name}
              className="w-20 h-20 rounded-2xl object-cover shadow-lg"
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{store.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-medium">{store.rating.toFixed(1)}</span>
                </div>
                <Badge variant={store.isOpen ? "default" : "secondary"}>
                  {store.isOpen ? "Abierto" : "Cerrado"}
                </Badge>
                {store.cityName && (
                  <Badge variant="outline">{store.cityName}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="mt-6 p-4 bg-card rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{store.address}</p>
                <p className="text-sm text-muted-foreground">{store.distance}</p>
              </div>
            </div>
            
            {store.latitude && store.longitude && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={openMaps}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Cómo llegar
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Products in this store */}
      <section className="container py-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Productos ({store.products.length})
          </h3>
        </div>

        {store.products.length === 0 ? (
          <div className="text-center py-8 bg-secondary rounded-xl">
            <p className="text-muted-foreground">
              No hay productos registrados en esta tienda
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {store.products.map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="bg-card rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-square bg-secondary">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-primary font-bold">
                      ${product.price.toLocaleString()}
                    </span>
                    {product.originalPrice && (
                      <span className="text-xs text-muted-foreground line-through">
                        ${product.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default StoreDetail;
