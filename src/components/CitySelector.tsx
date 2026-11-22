import { useState } from "react";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCities } from "@/hooks/useCities";

interface CitySelectorProps {
  selectedCityId: string | null;
  onCityChange: (cityId: string | null) => void;
}

const CitySelector = ({ selectedCityId, onCityChange }: CitySelectorProps) => {
  const [open, setOpen] = useState(false);

  // Misma consulta (y misma caché "cities") que el resto de la app, con coordenadas incluidas.
  const { data: cities = [] } = useCities();

  const selectedCity = cities.find((c) => c.id === selectedCityId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MapPin className="w-4 h-4" />
          <span className="hidden sm:inline">
            {selectedCity ? selectedCity.name : "Todas las ciudades"}
          </span>
          <span className="sm:hidden">
            {selectedCity ? selectedCity.name.slice(0, 8) : "Ciudad"}
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          <button
            onClick={() => {
              onCityChange(null);
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-secondary transition-colors ${
              !selectedCityId ? "bg-primary-light text-primary" : ""
            }`}
          >
            <span>Todas las ciudades</span>
            {!selectedCityId && <Check className="w-4 h-4" />}
          </button>
          
          {cities.map((city) => (
            <button
              key={city.id}
              onClick={() => {
                onCityChange(city.id);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-secondary transition-colors ${
                selectedCityId === city.id ? "bg-primary-light text-primary" : ""
              }`}
            >
              <div>
                <p className="font-medium">{city.name}</p>
                <p className="text-xs text-muted-foreground">{city.province}</p>
              </div>
              {selectedCityId === city.id && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CitySelector;
