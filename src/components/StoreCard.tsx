import { MapPin, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface StoreCardProps {
  id: string;
  name: string;
  address?: string;
  city?: string;
  distance?: number | null;
  distanceKm?: number | null;
  image_url?: string;
  logo_url?: string;
  image?: string;
  logo?: string;
  rating?: number;
  active_deals?: number;
}

const StoreCard = ({
  name,
  address,
  city,
  distance,
  distanceKm,
  image_url,
  logo_url,
  image,
  logo,
}: StoreCardProps) => {
  // Validación segura de la distancia para evitar error con .toFixed()
  const rawDist = distance ?? distanceKm;
  const distNumber = typeof rawDist === "number" && !isNaN(rawDist) ? rawDist : null;

  const displayImage = image_url || image || "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&q=80";
  const displayLogo = logo_url || logo;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="relative w-12 h-12 rounded-xl bg-secondary flex items-center justify-center overflow-hidden shrink-0 border border-border">
          {displayLogo ? (
            <img src={displayLogo} alt={name} className="w-full h-full object-cover" />
          ) : (
            <img src={displayImage} alt={name} className="w-full h-full object-cover" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-base line-clamp-1">{name}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 line-clamp-1">
            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
            {address || city || "Rosario"}
          </p>
        </div>
      </div>

      {distNumber !== null && (
        <Badge variant="secondary" className="shrink-0 flex items-center gap-1 font-medium bg-primary/10 text-primary hover:bg-primary/20 border-none px-2.5 py-1">
          <Navigation className="w-3 h-3" />
          {distNumber.toFixed(1)} km
        </Badge>
      )}
    </div>
  );
};

export default StoreCard;
