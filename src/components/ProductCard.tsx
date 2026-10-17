import { useNavigate } from "react-router-dom";
import { ShoppingBag, TrendingDown, ExternalLink, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";

interface PriceInfo {
  store: string;
  price: number;
  originalPrice?: number;
  logo: string;
  storeId?: string;
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
  const savingsPercent = highestPrice > 0 ? Math.round(((highestPrice - bestPrice) / highestPrice) * 100) : 0;
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
      className="card-elevated overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-square bg-secondary overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {savingsPercent > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1 rounded-full text-xs font-semibold">
            <TrendingDown className="w-3 h-3" />
            Ahorra {savingsPercent}%
          </div>
        )}
        <button
          onClick={handleFavoriteClick}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            favorite
              ? "bg-destructive text-destructive-foreground"
              : "bg-card/80 text-muted-foreground hover:text-destructive"
          }`}
        >
          <Heart className={`w-4 h-4 ${favorite ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {category}
        </span>
        <h3 className="font-semibold text-foreground mt-1 line-clamp-2 group-hover:text-primary transition-colors">
          {name}
        </h3>

        {/* Prices */}
        <div className="mt-3 space-y-2">
          {prices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin precios disponibles</p>
          ) : (
            prices.slice(0, 2).map((priceInfo, index) => (
              <div
                key={`${priceInfo.storeId}-${index}`}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:opacity-80 ${
                  index === 0 ? "bg-primary-light" : "bg-secondary"
                }`}
                onClick={(e) => handleStoreClick(e, priceInfo.storeId)}
              >
                <div className="flex items-center gap-2">
                  <img
                    src={priceInfo.logo}
                    alt=""
                    className="w-6 h-6 rounded-md object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {priceInfo.store}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold ${
                      index === 0 ? "text-primary" : "text-foreground"
                    }`}
                  >
                    ${priceInfo.price.toLocaleString()}
                  </span>
                  {priceInfo.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through ml-1">
                      ${priceInfo.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {prices.length > 2 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            +{prices.length - 2} tiendas más
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button variant="action" className="flex-1" size="sm">
            <ShoppingBag className="w-4 h-4" />
            Comparar
          </Button>
          <Button variant="outline" size="icon" className="shrink-0">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;