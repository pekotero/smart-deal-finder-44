import { useNavigate } from "react-router-dom";
import { ShoppingBag, TrendingDown, ExternalLink, Heart, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";

export interface PriceInfo {
  store: string;
  price: number;
  originalPrice?: number;
  logo: string;
  storeId?: string;
  distance?: string;
  distanceKm?: number;
}

interface ProductCardProps {
  id: string;
  name: string;
  image: string;
  category: string;
  prices: PriceInfo[];
  onClick?: () => void;
}

const ProductCard = ({ id, name, image, category, prices, onClick }: ProductCardProps) => {
  const navigate = useNavigate();
  const { toggleFavorite, isFavorite } = useFavorites();
  
  const bestPrice = prices.length > 0 ? Math.min(...prices.map((p) => p.price)) : 0;
  const highestPrice = prices.length > 0 ? Math.max(...prices.map((p) => p.price)) : 0;
  
  // Solo consideramos que hay una "Mejor oferta" destacada si los precios de las distintas tiendas varían
  const hasPriceDifference = prices.length > 1 && bestPrice < highestPrice;
  const savingsPercent = hasPriceDifference ? Math.round(((highestPrice - bestPrice) / highestPrice) * 100) : 0;
  const favorite = isFavorite(id);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(id);
  };

  const handleStoreClick = (e: React.MouseEvent, storeId?: string) => {
    e.stopPropagation();
    if (storeId) {
      navigate(`/store/${storeId}`);
    }
  };

  return (
    <div
      className="card-elevated overflow-hidden cursor-pointer group flex flex-col justify-between h-full border border-border/50 hover:border-primary/40 transition-all shadow-sm hover:shadow-md rounded-2xl bg-card"
      onClick={onClick}
    >
      <div>
        {/* Image & Badges */}
        <div className="relative aspect-square bg-secondary/30 overflow-hidden p-4 flex items-center justify-center">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
          {savingsPercent > 0 && (
            <div className="absolute top-3 left-3 flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm">
              <TrendingDown className="w-3.5 h-3.5" />
              Ahorra {savingsPercent}%
            </div>
          )}
          <button
            onClick={handleFavoriteClick}
            className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
              favorite
                ? "bg-destructive text-destructive-foreground"
                : "bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive"
            }`}
          >
            <Heart className={`w-4 h-4 ${favorite ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-md">
            {category}
          </span>
          <h3 className="font-semibold text-foreground mt-2 line-clamp-2 text-sm sm:text-base leading-snug group-hover:text-primary transition-colors">
            {name}
          </h3>

          {/* Prices List */}
          <div className="mt-4 space-y-2">
            {prices.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin precios registrados en tu zona</p>
            ) : (
              prices.slice(0, 3).map((priceInfo, index) => {
                const isBest = hasPriceDifference && priceInfo.price === bestPrice;
                return (
                  <div
                    key={`${priceInfo.storeId}-${index}`}
                    className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                      isBest 
                        ? "bg-emerald-500/10 border border-emerald-500/30" 
                        : "bg-secondary/40 hover:bg-secondary"
                    }`}
                    onClick={(e) => handleStoreClick(e, priceInfo.storeId)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground truncate">
                            {priceInfo.store}
                          </span>
                          {isBest && (
                            <span className="flex items-center gap-0.5 text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">
                              <Check className="w-2.5 h-2.5" /> Mejor
                            </span>
                          )}
                        </div>
                        {priceInfo.distance && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="w-2.5 h-2.5 text-primary/70" />
                            <span>{priceInfo.distance}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`font-bold text-sm sm:text-base ${isBest ? "text-emerald-600" : "text-foreground"}`}>
                        ${priceInfo.price.toLocaleString("es-AR")}
                      </div>
                      {priceInfo.originalPrice && priceInfo.originalPrice > priceInfo.price && (
                        <div className="text-[10px] text-muted-foreground line-through">
                          ${priceInfo.originalPrice.toLocaleString("es-AR")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {prices.length > 3 && (
            <p className="text-[11px] text-muted-foreground mt-2 text-center font-medium">
              +{prices.length - 3} sucursales más comparadas
            </p>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 pt-0">
        <div className="flex gap-2">
          <Button variant="default" className="w-full text-xs font-semibold h-9 rounded-xl" size="sm">
            <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
            Ver Oferta
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl">
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;