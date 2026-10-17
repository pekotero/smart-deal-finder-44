import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Star, 
  ChevronLeft, 
  ChevronRight,
  Flag,
  Plus,
  User,
  ExternalLink,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation, calculateDistanceKm } from "@/hooks/useGeolocation";
import AddPriceModal from "@/components/AddPriceModal";
import ReportPriceModal from "@/components/ReportPriceModal";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PriceDetail {
  id: string;
  price: number;
  originalPrice?: number;
  lastUpdated: Date;
  contributedBy?: string;
  contributorName?: string;
  verified: boolean;
  store: {
    id: string;
    name: string;
    logo: string;
    address: string;
    latitude?: number;
    longitude?: number;
    distance?: string;
  };
}

interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  brand: string | null;
  category: string;
  categoryId: string;
  prices: PriceDetail[];
}

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { latitude: userLat, longitude: userLng } = useGeolocation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAddPrice, setShowAddPrice] = useState(false);
  const [reportingPriceId, setReportingPriceId] = useState<string | null>(null);

  const { data: product, isLoading, refetch } = useQuery({
    queryKey: ["product", id, userLat, userLng],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          description,
          image_url,
          images,
          brand,
          category_id,
          categories (id, name),
          prices (
            id,
            price,
            original_price,
            last_updated,
            contributed_by,
            contributor_name,
            verified,
            store_id,
            stores (
              id,
              name,
              logo_url,
              address,
              latitude,
              longitude
            )
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const images = data.images && data.images.length > 0 
        ? data.images 
        : [data.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800"];

      const prices: PriceDetail[] = (data.prices || []).map((p: any) => {
        const storeLat = p.stores?.latitude ? Number(p.stores.latitude) : undefined;
        const storeLng = p.stores?.longitude ? Number(p.stores.longitude) : undefined;
        
        let distanceStr = "Online";
        if (userLat && userLng && storeLat && storeLng) {
          const dist = calculateDistanceKm(userLat, userLng, storeLat, storeLng);
          distanceStr = `${dist.toFixed(1)} km`;
        }

        return {
          id: p.id,
          price: Number(p.price),
          originalPrice: p.original_price ? Number(p.original_price) : undefined,
          lastUpdated: new Date(p.last_updated),
          contributedBy: p.contributed_by,
          contributorName: p.contributor_name,
          verified: p.verified || false,
          store: {
            id: p.stores?.id,
            name: p.stores?.name || "Tienda",
            logo: p.stores?.logo_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=50",
            address: p.stores?.address || "Dirección no disponible",
            latitude: storeLat,
            longitude: storeLng,
            distance: distanceStr,
          },
        };
      }).sort((a: PriceDetail, b: PriceDetail) => a.price - b.price);

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        images,
        brand: data.brand,
        category: data.categories?.name || "Sin categoría",
        categoryId: data.category_id,
        prices,
      } as ProductDetail;
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

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">Producto no encontrado</p>
        <Button onClick={() => navigate("/")}>Volver al inicio</Button>
      </div>
    );
  }

  const bestPrice = product.prices[0]?.price || 0;
  const highestPrice = product.prices[product.prices.length - 1]?.price || 0;
  const savingsPercent = highestPrice > 0 
    ? Math.round(((highestPrice - bestPrice) / highestPrice) * 100) 
    : 0;

  const nextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === product.images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? product.images.length - 1 : prev - 1
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold truncate">{product.name}</h1>
            <p className="text-sm text-muted-foreground">{product.category}</p>
          </div>
        </div>
      </header>

      {/* Image Gallery */}
      <section className="relative bg-secondary">
        <div className="aspect-square relative overflow-hidden">
          <img
            src={product.images[currentImageIndex]}
            alt={product.name}
            className="w-full h-full object-contain"
          />
          
          {product.images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Image indicators */}
        {product.images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {product.images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentImageIndex 
                    ? "bg-primary w-6" 
                    : "bg-card/60"
                }`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Product Info */}
      <section className="container py-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {product.brand && (
              <Badge variant="secondary" className="mb-2">{product.brand}</Badge>
            )}
            <h2 className="text-2xl font-bold">{product.name}</h2>
          </div>
          {savingsPercent > 0 && (
            <Badge className="bg-primary text-primary-foreground shrink-0">
              Ahorra {savingsPercent}%
            </Badge>
          )}
        </div>

        {product.description && (
          <p className="text-muted-foreground mb-6">{product.description}</p>
        )}

        {/* Price Summary */}
        {product.prices.length > 0 && (
          <div className="p-4 bg-primary-light rounded-xl mb-6">
            <p className="text-sm text-muted-foreground mb-1">Mejor precio</p>
            <p className="text-3xl font-bold text-primary">
              ${bestPrice.toLocaleString()}
            </p>
            {product.prices.length > 1 && (
              <p className="text-sm text-muted-foreground mt-1">
                en {product.prices[0].store.name} • Ahorrás ${(highestPrice - bestPrice).toLocaleString()} vs el más caro
              </p>
            )}
          </div>
        )}
      </section>

      {/* Price Comparison */}
      <section className="container pb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Comparar precios ({product.prices.length} tiendas)
          </h3>
          {user && (
            <Button variant="outline" size="sm" onClick={() => setShowAddPrice(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Agregar precio
            </Button>
          )}
        </div>

        {product.prices.length === 0 ? (
          <div className="text-center py-8 bg-secondary rounded-xl">
            <p className="text-muted-foreground mb-4">
              No hay precios disponibles para este producto
            </p>
            {user ? (
              <Button variant="action" onClick={() => setShowAddPrice(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar primer precio
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Inicia sesión para agregar precios
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {product.prices.map((priceInfo, index) => (
              <div
                key={priceInfo.id}
                className={`p-4 rounded-xl border ${
                  index === 0 
                    ? "border-primary bg-primary-light" 
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Link 
                    to={`/store/${priceInfo.store.id}`}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={priceInfo.store.logo}
                      alt={priceInfo.store.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {priceInfo.store.name}
                        {index === 0 && (
                          <Badge variant="default" className="text-xs">Mejor precio</Badge>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{priceInfo.store.distance}</span>
                      </div>
                    </div>
                  </Link>

                  <div className="text-right">
                    <p className={`text-xl font-bold ${index === 0 ? "text-primary" : ""}`}>
                      ${priceInfo.price.toLocaleString()}
                    </p>
                    {priceInfo.originalPrice && (
                      <p className="text-sm text-muted-foreground line-through">
                        ${priceInfo.originalPrice.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Price metadata */}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(priceInfo.lastUpdated, "d MMM yyyy", { locale: es })}
                    </span>
                    {priceInfo.contributorName && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {priceInfo.contributorName}
                        {priceInfo.verified && (
                          <Star className="w-3 h-3 text-primary fill-primary" />
                        )}
                      </span>
                    )}
                  </div>
                  
                  {user && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs h-auto py-1"
                      onClick={() => setReportingPriceId(priceInfo.id)}
                    >
                      <Flag className="w-3 h-3 mr-1" />
                      Reportar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      {showAddPrice && (
        <AddPriceModal
          productId={product.id}
          productName={product.name}
          onClose={() => setShowAddPrice(false)}
          onSuccess={() => {
            setShowAddPrice(false);
            refetch();
          }}
        />
      )}

      {reportingPriceId && (
        <ReportPriceModal
          priceId={reportingPriceId}
          onClose={() => setReportingPriceId(null)}
        />
      )}
    </div>
  );
};

export default ProductDetail;
