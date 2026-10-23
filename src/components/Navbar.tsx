import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-xl text-primary">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-gray-900 tracking-tight">
            Smart Deal <span className="text-primary">Finder</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/map")}
            className="flex items-center gap-2 text-gray-600 hover:text-primary"
          >
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-medium">Mapa de Tiendas</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;