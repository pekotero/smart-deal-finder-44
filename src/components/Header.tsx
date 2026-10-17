import { Search, MapPin, User, Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import CitySelector from "@/components/CitySelector";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onAuthClick: () => void;
  onMapClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCityId: string | null;
  onCityChange: (cityId: string | null) => void;
}

const Header = ({ 
  onAuthClick, 
  onMapClick, 
  searchQuery, 
  onSearchChange,
  selectedCityId,
  onCityChange,
}: HeaderProps) => {
  const { user, signOut } = useAuth();
  const { isVerified } = useUserRole();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="container py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">$</span>
            </div>
            <span className="text-xl font-bold hidden sm:block">
              <span className="gradient-text">Compara</span>
              <span className="text-accent">Ya</span>
            </span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full h-11 pl-12 pr-4 rounded-xl bg-secondary border-2 border-transparent focus:border-primary focus:bg-card outline-none transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* City Selector */}
            <CitySelector 
              selectedCityId={selectedCityId} 
              onCityChange={onCityChange} 
            />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onMapClick}
              className="hidden sm:flex"
            >
              <MapPin className="w-5 h-5" />
            </Button>
            
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                {isVerified && (
                  <Badge variant="default" className="text-xs">Verificado</Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/profile")}
                  className="gap-2 rounded-xl"
                >
                  <User className="w-4 h-4" />
                  <span className="truncate max-w-[100px]">
                    {user.email?.split("@")[0]}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut()}
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="action"
                size="sm"
                onClick={() => navigate("/auth")}
                className="hidden sm:flex"
              >
                <User className="w-4 h-4" />
                Ingresar
              </Button>
            )}
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={onAuthClick}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
