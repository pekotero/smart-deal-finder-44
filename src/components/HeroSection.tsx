import { Search, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  onSearchClick?: () => void;
  onMapClick?: () => void;
}

const HeroSection = ({ onSearchClick, onMapClick }: HeroSectionProps) => {
  return (
    <section className="relative overflow-hidden gradient-hero text-primary-foreground">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl" />
      </div>

      <div className="container relative py-12 md:py-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Compara y ahorra en tus compras</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4">
            Encuentra el{" "}
            <span className="relative">
              mejor precio
              <svg
                className="absolute -bottom-2 left-0 w-full h-3 text-accent"
                viewBox="0 0 100 12"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 8C20 2 40 2 50 6C60 10 80 10 100 4"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            cerca de ti
          </h1>

          <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-lg">
            Compara precios entre tiendas locales, encuentra ofertas reales
            y toma decisiones inteligentes para tu bolsillo.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="action"
              size="xl"
              onClick={onSearchClick}
              className="group"
            >
              <Search className="w-5 h-5 transition-transform group-hover:scale-110" />
              Buscar productos
            </Button>
            <Button variant="hero" size="xl" onClick={onMapClick}>
              <MapPin className="w-5 h-5" />
              Ver tiendas cercanas
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
