import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ProductCard from "@/components/ProductCard";
import StoreCard from "@/components/StoreCard";
import CategoryPill from "@/components/CategoryPill";
import BottomNav from "@/components/BottomNav";
import AuthModal from "@/components/AuthModal";
import MapView from "@/components/MapView";
import SearchPopup from "@/components/SearchPopup";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/useProducts";
import { useStores } from "@/hooks/useStores";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useFavorites } from "@/hooks/useFavorites";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("home");
  const [showAuth, setShowAuth] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  const { user } = useAuth();
  const { favorites } = useFavorites();
  const { isVerified, canAddPrices, remainingFreeContributions } = useUserRole();
  
  // Get user location
  const { latitude: userLatitude, longitude: userLongitude, loading: locationLoading } = useGeolocation();

  // Debounce search query to avoid too many requests
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch data from database with location and city filtering
  const { data: products = [], isLoading: productsLoading } = useProducts({
    categoryId: activeCategory,
    searchQuery: debouncedSearchQuery,
    userLatitude,
    userLongitude,
    maxDistanceKm: 30, // Search in the whole city
    cityId: selectedCityId,
  });
  
  // Fetch stores with user location for distance calculation
  const { data: stores = [], isLoading: storesLoading } = useStores({
    userLatitude,
    userLongitude,
    maxDistanceKm: 30, // Show stores in the whole city
    cityId: selectedCityId,
  });
  
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  // Filter favorites
  const favoriteProducts = useMemo(() => {
    return products.filter((p) => favorites.includes(p.id));
  }, [products, favorites]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "map") {
      setShowMap(true);
    } else if (tab === "profile") {
      if (user) {
        navigate("/profile");
      } else {
        navigate("/auth");
      }
    }
  };

  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  const displayProducts = activeTab === "favorites" ? favoriteProducts : products;

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-0">
      <Header
        onAuthClick={() => user ? null : navigate("/auth")}
        onMapClick={() => setShowMap(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCityId={selectedCityId}
        onCityChange={setSelectedCityId}
      />

      <HeroSection 
        onSearchClick={() => setShowSearchPopup(true)}
        onMapClick={() => setShowMap(true)}
      />

      <SearchPopup
        open={showSearchPopup}
        onOpenChange={setShowSearchPopup}
        onSearch={(query) => setSearchQuery(query)}
        initialQuery={searchQuery}
      />

      {/* Categories */}
      <section className="py-6 border-b border-border">
        <div className="container">
          {categoriesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((category) => (
                <CategoryPill
                  key={category.id}
                  icon={category.icon}
                  label={category.name}
                  isActive={activeCategory === category.id}
                  onClick={() => setActiveCategory(category.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* User contribution info */}
      {user && canAddPrices && !isVerified && (
        <div className="container py-3">
          <div className="p-3 bg-accent-light rounded-xl flex items-center justify-between">
            <p className="text-sm">
              <strong>{remainingFreeContributions}</strong> aportes gratis restantes.{" "}
              <span className="text-muted-foreground">Verifica tu email para aportes ilimitados.</span>
            </p>
          </div>
        </div>
      )}

      {/* Products */}
      <section className="py-8">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {activeTab === "favorites" ? "Tus favoritos" : "Mejores ofertas"}
              </h2>
              <p className="text-muted-foreground">
                {activeTab === "favorites"
                  ? `${favoriteProducts.length} productos guardados`
                  : debouncedSearchQuery 
                    ? `Resultados para "${debouncedSearchQuery}"`
                    : "Comparamos precios para que ahorres"}
              </p>
            </div>
          </div>

          {productsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeTab === "favorites"
                  ? "No tienes productos favoritos aún"
                  : debouncedSearchQuery 
                    ? `No se encontraron productos para "${debouncedSearchQuery}"`
                    : "No se encontraron productos"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayProducts.map((product, index) => (
                <div
                  key={product.id}
                  className={`opacity-0 animate-fade-up stagger-${(index % 4) + 1}`}
                  style={{ animationFillMode: "forwards" }}
                >
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    image={product.image}
                    category={product.category}
                    prices={product.prices}
                    onClick={() => handleProductClick(product.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stores */}
      <section className="py-8 bg-secondary/50">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Tiendas cercanas
              </h2>
              <p className="text-muted-foreground">
                {locationLoading 
                  ? "Obteniendo tu ubicación..."
                  : userLatitude && userLongitude
                    ? `${stores.length} tiendas cerca de ti`
                    : "Activa la ubicación para ver tiendas cercanas"}
              </p>
            </div>
            {user && isVerified && (
              <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar tienda
              </Button>
            )}
          </div>

          {storesLoading || locationLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No hay tiendas cercanas a tu ubicación
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.map((store) => (
                <div 
                  key={store.id} 
                  onClick={() => navigate(`/store/${store.id}`)}
                  className="cursor-pointer"
                >
                  <StoreCard {...store} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bottom Navigation (Mobile) */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Modals */}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      {showMap && <MapView stores={stores} onClose={() => setShowMap(false)} />}
    </div>
  );
};

export default Index;