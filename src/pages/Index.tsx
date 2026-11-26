import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, SlidersHorizontal } from "lucide-react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ProductCard from "@/components/ProductCard";
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
import { useCities } from "@/hooks/useCities";
import { compareSizeKeys, sizeFromName, sizeKey, sizeLabel, unitPrice } from "@/lib/size";
import { useUserRole } from "@/hooks/useUserRole";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { activeFilterCount, applyPriceFilters, searchWithExclusions } from "@/lib/filters";

// Productos que se muestran de entrada y que suma cada "Ver más".
const PAGE_SIZE = 50;

const Index = () => {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Tamaño elegido ("1.5 lt", "0.5 kg"...); "" = todos.
  const [sizeFilter, setSizeFilter] = useState("");
  // "" = más comparados primero; "unit" = menor precio por litro/kilo.
  const [sortBy, setSortBy] = useState<"" | "unit">("");
  // "online" = sólo tiendas online (PedidosYa).
  const [storeFilter, setStoreFilter] = useState<"" | "online">("");
  // Más filtros: rango de precio (sobre el mejor precio), sólo con descuento y palabras a excluir.
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [exclude, setExclude] = useState("");
  // Pestaña inicial desde la URL (la pestaña Promos vuelve con ?tab=map, ?tab=favorites...).
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "home";
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showAuth, setShowAuth] = useState(false);
  const [showMap, setShowMap] = useState(initialTab === "map");
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  const { user } = useAuth();
  const { favorites } = useFavorites();
  const { isVerified, canAddPrices, remainingFreeContributions } = useUserRole();
  
  // Get user location
  const {
    latitude: userLatitude,
    longitude: userLongitude,
    loading: locationLoading,
    isFallback: locationFallback,
    denied: locationDenied,
    error: locationError,
    retry: retryLocation,
  } = useGeolocation();

  // Debounce search query to avoid too many requests
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const debouncedExclude = useDebounce(exclude, 400);

  // Con una ciudad elegida se busca alrededor de su centro (las tiendas no tienen city_id cargado).
  const { data: cities = [] } = useCities();
  const selectedCity = cities.find((c) => c.id === selectedCityId && c.latitude != null && c.longitude != null);
  const centerLatitude = selectedCity ? selectedCity.latitude : userLatitude;
  const centerLongitude = selectedCity ? selectedCity.longitude : userLongitude;

  // Tiendas a 30 km del usuario (o de la ciudad elegida)
  const { data: stores = [], isLoading: storesLoading } = useStores({
    userLatitude: centerLatitude,
    userLongitude: centerLongitude,
    maxDistanceKm: 30,
    enabled: !locationLoading,
  });

  // Productos con precio en alguna cadena que tenga sucursal entre esas tiendas
  // (la base los devuelve de a páginas, primero los que se pueden comparar en más tiendas)
  const {
    data: products = [],
    isLoading: homeLoading,
    total: productsTotal,
    hasMore,
    loadMore,
    loadingMore,
  } = useProducts({
    categoryId: activeCategory,
    searchQuery: searchWithExclusions(debouncedSearchQuery, debouncedExclude),
    nearbyStores: stores,
    enabled: !locationLoading && !storesLoading,
  });

  // Los favoritos se piden aparte: pueden no estar entre las páginas ya cargadas.
  const { data: favoriteProducts = [], isLoading: favoritesLoading } = useProducts({
    productIds: favorites,
    nearbyStores: stores,
    enabled: activeTab === "favorites" && !locationLoading && !storesLoading,
  });
  const productsLoading = activeTab === "favorites" ? favoritesLoading : homeLoading;
  
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  const handleTabChange = (tab: string) => {
    if (tab === "promos") {
      navigate("/promos");
      return;
    }
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

  const priceFilters = { min: Number(minPrice) || null, max: Number(maxPrice) || null, onlyDiscount };
  const extraFilters = activeFilterCount({ ...priceFilters, exclude });
  const clientFilters = !!(priceFilters.min || priceFilters.max || onlyDiscount);
  const baseList = activeTab === "favorites" ? favoriteProducts : products;
  // Con "Solo online" cada producto queda con los precios de tiendas online, y sin ellos no se muestra.
  const listByCategory = useMemo(() => {
    const byStore =
      storeFilter !== "online"
        ? baseList
        : baseList
            .map((p) => {
              const prices = p.prices.filter((pr) => pr.online);
              return { ...p, prices, bestPrice: prices[0]?.price };
            })
            .filter((p) => p.prices.length > 0);
    return applyPriceFilters(byStore, { min: Number(minPrice) || null, max: Number(maxPrice) || null, onlyDiscount });
  }, [baseList, storeFilter, minPrice, maxPrice, onlyDiscount]);

  // Tamaños presentes en la lista actual (leídos del nombre), con cuántos productos tiene cada uno.
  const sizeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of listByCategory) {
      const k = sizeKey(sizeFromName(p.name));
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => compareSizeKeys(a[0], b[0]));
  }, [listByCategory]);

  const shownProducts = useMemo(() => {
    const list = sizeFilter
      ? listByCategory.filter((p) => sizeKey(sizeFromName(p.name)) === sizeFilter)
      : listByCategory;
    if (sortBy !== "unit") return list;
    // Menor precio por litro/kilo (con el mejor precio de cada producto). Litros, kilos y
    // unidades no se comparan entre sí: van en ese orden; los que no tienen tamaño, al final.
    const UNIT_RANK = { lt: 0, kg: 1, un: 2 } as Record<string, number>;
    const withUnit = list.map((p) => ({ p, u: unitPrice(p.bestPrice ?? 0, sizeFromName(p.name)) }));
    withUnit.sort((a, b) => {
      if (!a.u || !b.u) return (a.u ? 0 : 1) - (b.u ? 0 : 1);
      return UNIT_RANK[a.u.unit] - UNIT_RANK[b.u.unit] || a.u.value - b.u.value;
    });
    return withUnit.map((x) => x.p);
  }, [listByCategory, sizeFilter, sortBy]);
  const displayProducts = shownProducts;

  // Al cambiar de categoría, búsqueda o pestaña se vuelve a "todos los tamaños" y a la primera página.
  useEffect(() => {
    setSizeFilter("");
  }, [activeCategory, debouncedSearchQuery, activeTab]);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, debouncedSearchQuery, activeTab, sizeFilter, sortBy, storeFilter, minPrice, maxPrice, onlyDiscount, debouncedExclude]);

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
          {!locationLoading && locationFallback && !selectedCity && (
            <div className="mb-6 p-3 rounded-xl bg-accent-light text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p>
                <strong>No pudimos usar tu ubicación</strong> y mostramos precios cerca del centro de Rosario.{" "}
                {locationError}{" "}
                {locationDenied
                  ? "Tocá el candado o el ícono de ubicación al lado de la dirección del sitio, permití la ubicación y reintentá."
                  : "Revisá que la ubicación del dispositivo esté activada."}
              </p>
              <Button variant="outline" size="sm" className="shrink-0" onClick={retryLocation}>
                Reintentar
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
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
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Tiendas</span>
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value as "" | "online")}
                  aria-label="Tiendas a comparar"
                  className="h-9 rounded-lg border border-border bg-card px-2 text-foreground"
                >
                  <option value="">Todas</option>
                  <option value="online">Solo online (PedidosYa)</option>
                </select>
              </label>
              {(sizeOptions.length > 1 || sizeFilter) && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Tamaño</span>
                  <select
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                    aria-label="Tamaño del producto"
                    className="h-9 rounded-lg border border-border bg-card px-2 text-foreground"
                  >
                    <option value="">Todos ({listByCategory.length})</option>
                    {sizeOptions.map(([key, count]) => (
                      <option key={key} value={key}>
                        {sizeLabel(key)} ({count})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg">
                    <SlidersHorizontal className="w-4 h-4" aria-hidden />
                    Filtros
                    {extraFilters > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {extraFilters}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Precio</p>
                    <div className="flex items-center gap-2">
                      <Input
                        inputMode="numeric"
                        placeholder="Mínimo"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ""))}
                        aria-label="Precio mínimo"
                        className="h-9"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        inputMode="numeric"
                        placeholder="Máximo"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
                        aria-label="Precio máximo"
                        className="h-9"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyDiscount}
                      onChange={(e) => setOnlyDiscount(e.target.checked)}
                      className="w-4 h-4 accent-[hsl(var(--primary))]"
                    />
                    Sólo con descuento
                  </label>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Sin estas palabras</p>
                    <Input
                      placeholder="Ej.: dulce, polvo"
                      value={exclude}
                      onChange={(e) => setExclude(e.target.value)}
                      aria-label="Palabras a excluir de la búsqueda"
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">Para buscar «leche» sin que aparezca «dulce de leche».</p>
                  </div>
                  {extraFilters > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setMinPrice("");
                        setMaxPrice("");
                        setOnlyDiscount(false);
                        setExclude("");
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
              {listByCategory.length > 1 && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Ordenar</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "" | "unit")}
                    aria-label="Ordenar productos"
                    className="h-9 rounded-lg border border-border bg-card px-2 text-foreground"
                  >
                    <option value="">Más comparados</option>
                    <option value="unit">Menor precio por litro/kilo</option>
                  </select>
                </label>
              )}
            </div>
          </div>

          {(shownProducts.length > PAGE_SIZE || (activeTab !== "favorites" && hasMore)) && (
            <p className="text-sm text-muted-foreground -mt-3 mb-4">
              Mostrando {Math.min(visibleCount, shownProducts.length).toLocaleString("es-AR")} de{" "}
              {(activeTab !== "favorites" && !storeFilter && !sizeFilter && !clientFilters
                ? Math.max(productsTotal, shownProducts.length)
                : shownProducts.length
              ).toLocaleString("es-AR")}
              {activeTab !== "favorites" && hasMore && (storeFilter || sizeFilter || sortBy || clientFilters) ? " (entre los cargados)" : ""}
            </p>
          )}

          {productsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeTab === "favorites"
                  ? "No tienes productos favoritos aún"
                  : extraFilters > 0
                    ? "Ningún producto de los cargados cumple los filtros"
                    : debouncedSearchQuery
                      ? `No se encontraron productos para "${debouncedSearchQuery}"`
                      : "No se encontraron productos"}
              </p>
              {activeTab !== "favorites" && hasMore && clientFilters && (
                <Button variant="outline" className="mt-4" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Buscar en más productos
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayProducts.slice(0, visibleCount).map((product, index) => (
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
                    prices={product.prices.map((p) => ({
                      store: p.store,
                      price: p.price,
                      originalPrice: p.originalPrice,
                      storeId: p.store_id,
                      distanceKm: p.distance,
                      distance: p.distance != null ? `a ${p.distance.toFixed(1).replace(".", ",")} km` : undefined,
                    }))}
                    onClick={() => handleProductClick(product.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {!productsLoading && (visibleCount < displayProducts.length || (activeTab !== "favorites" && hasMore)) && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() => {
                  // Si se termina lo cargado, se pide la página siguiente a la base.
                  if (activeTab !== "favorites" && hasMore && visibleCount + PAGE_SIZE > displayProducts.length) loadMore();
                  setVisibleCount((n) => n + PAGE_SIZE);
                }}
              >
                {loadingMore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Ver más
              </Button>
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