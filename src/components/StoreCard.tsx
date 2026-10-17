import { MapPin, Star, Clock } from "lucide-react";

interface StoreCardProps {
  id?: string;
  name: string;
  logo: string;
  address: string;
  rating: number;
  distance: string;
  isOpen: boolean;
  productsCount: number;
  latitude?: number | null;
  longitude?: number | null;
  onClick?: () => void;
}

const StoreCard = ({
  name,
  logo,
  address,
  rating,
  distance,
  isOpen,
  productsCount,
  onClick,
}: StoreCardProps) => {
  return (
    <div
      className="card-elevated p-4 cursor-pointer flex gap-4"
      onClick={onClick}
    >
      {/* Logo */}
      <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center overflow-hidden shrink-0">
        <img src={logo} alt={name} className="w-12 h-12 object-contain" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground truncate">{name}</h3>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
              isOpen
                ? "bg-primary-light text-primary"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {isOpen ? "Abierto" : "Cerrado"}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-accent text-accent" />
            <span>{rating.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{distance}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{productsCount} productos</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-1 truncate">{address}</p>
      </div>
    </div>
  );
};

export default StoreCard;
