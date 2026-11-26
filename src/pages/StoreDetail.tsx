import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Navigation, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation, calculateDistanceKm } from "@/hooks/useGeolocation";
import { chainOf, getOnlineSources } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useDebounce } from "@/hooks/useDebounce";
import StoreReviews, { StoreRating } from "@/components/StoreReviews";

interface StoreProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
}

interface StoreDetailData {
  id: string;
  name: string;
  logo: string;
  address: string;
  isOpen: boolean;
  latitude?: number;
  longitude?: number;
  distance?: string;
  cityName?: string;
  // Esta sucursal y las tiendas online de su cadena (de ahí salen los precios).
  storeIds: string[];
}

const PAGE = 60;

type CatalogRow = {
  id: string;
  name: string;
  image_url: string | null;
  total: number;
  prices: { store_id: string; price: number; original_price: number | null; last_updated: string | null }[] | null;
};

// Precio de esta sucursal si lo tiene; si no, el online más reciente de la cadena.
function toProduct(r: CatalogRow, storeId: string): StoreProduct {
  const prices = r.prices || [];
  const pr =
    prices.find((x) => x.store_id === storeId) ||
    [...prices].sort((x, y) => (y.last_updated || "").localeCompare(x.last_updated || ""))[0];
  const price = Number(pr?.price);
  const orig = pr?.original_price ? Number(pr.original_price) : undefined;
  return {
    id: r.id,
    name: r.name || "Producto",
    image: r.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=200",
    price,
    originalPrice: orig && orig > price && orig <= price * 3 ? orig : undefined,
  };
}

const StoreDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { latitude: userLat, longitude: userLng } = useGeolocation();

  const { data: store, isLoading } = useQuery({
    queryKey: ["store", id, userLat, userLng],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, logo_url, address, is_open, latitude, longitude, city_id, cities (name)")
        .eq("id", id!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const storeLat = data.latitude ? Number(data.latitude) : undefined;
      const storeLng = data.longitude ? Number(data.longitude) : undefined;

      let distanceStr = "Online";
      if (userLat && userLng && storeLat && storeLng) {
        distanceStr = `${calculateDistanceKm(userLat, userLng, storeLat, storeLng).toFixed(1)} km`;
      }

      const chain = chainOf(data.name || "");
      const online = (await getOnlineSources()).filter((s) => chainOf(s.name) === chain && s.id !== data.id);

      return {
        id: data.id,
        name: data.name,
        logo: data.logo_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=200",
        address: data.address || "Dirección no disponible",
        isOpen: data.is_open ?? true,
        latitude: storeLat,
        longitude: storeLng,
        distance: distanceStr,
        cityName: (data.cities as { name?: string } | null)?.name,
        storeIds: [data.id, ...online.map((s) => s.id)],
      } as StoreDetailData;
    },
    enabled: !!id,
  });

  // Catálogo: búsqueda y categoría en la base, de a páginas.
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const q = useDebounce(query.trim(), 300);
  const { data: categories = [] } = useCategories();
  const catalog = useInfiniteQuery({
    queryKey: ["store_catalog", store?.storeIds.join(","), q, cat],
    enabled: !!store,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("search_products", {
        store_ids: store!.storeIds,
        q: q || null,
        cat: cat === "all" ? null : cat,
        lim: PAGE,
        off: pageParam,
      });
      if (error) throw error;
      const rows = (data || []) as unknown as CatalogRow[];
      return { rows, total: Number(rows[0]?.total ?? 0), next: pageParam + rows.length };
    },
    getNextPageParam: (last) => (last.rows.length === PAGE && last.next < last.total ? last.next : undefined),
  });
  const products = (catalog.data?.pages || [])
    .flatMap((p) => p.rows.map((r) => toProduct(r, store!.id)))
    .filter((p) => p.price > 0);
  const totalProducts = catalog.data?.pages[0]?.total ?? 0;
  const filtering = !!q || cat !== "all";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">Tienda no encontrada</p>
        <Button onClick={() => navigate("/")}>Volver al inicio</Button>
      </div>
    );
  }

  const openMaps = () => {
    if (store.latitude && store.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{store.name}</h1>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-primary/10 to-background">
        <div className="container py-8">
          <div className="flex items-start gap-4">
            <img src={store.logo} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold">{store.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <StoreRating storeId={store.id} />
                <Badge variant={store.isOpen ? "default" : "secondary"}>{store.isOpen ? "Abierto" : "Cerrado"}</Badge>
                {store.cityName && <Badge variant="outline">{store.cityName}</Badge>}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-card rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{store.address}</p>
                <p className="text-sm text-muted-foreground">{store.distance}</p>
              </div>
            </div>

            {store.latitude && store.longitude && (
              <Button variant="outline" className="w-full" onClick={openMaps}>
                <Navigation className="w-4 h-4 mr-2" />
                Cómo llegar
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Catálogo */}
      <section className="container py-6 space-y-4" aria-labelledby="catalogo">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="catalogo" className="text-lg font-semibold">Catálogo</h3>
          {!catalog.isLoading && !catalog.isError && (
            <span className="text-sm text-muted-foreground">
              {totalProducts.toLocaleString("es-AR")} {filtering ? "encontrados" : "productos"}
            </span>
          )}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar en ${chainOf(store.name)}…`}
            aria-label="Buscar en el catálogo de la tienda"
            className="pl-9 rounded-xl"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" role="group" aria-label="Categorías">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              aria-pressed={cat === c.id}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                cat === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {catalog.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : catalog.isError ? (
          <p className="text-center py-8 text-muted-foreground">No se pudo cargar el catálogo.</p>
        ) : products.length === 0 ? (
          <div className="text-center py-8 bg-secondary rounded-xl">
            <p className="text-muted-foreground">
              {filtering ? "No encontramos productos con esa búsqueda en esta tienda." : "No hay productos registrados en esta tienda"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="bg-card rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-square bg-secondary">
                    <img src={product.image} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-primary font-bold">${product.price.toLocaleString("es-AR")}</span>
                      {product.originalPrice && (
                        <span className="text-xs text-muted-foreground line-through">${product.originalPrice.toLocaleString("es-AR")}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {catalog.hasNextPage && (
              <div className="flex flex-col items-center gap-1">
                <Button variant="outline" onClick={() => catalog.fetchNextPage()} disabled={catalog.isFetchingNextPage}>
                  {catalog.isFetchingNextPage && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Ver más
                </Button>
                <span className="text-xs text-muted-foreground">
                  Mostrando {products.length.toLocaleString("es-AR")} de {totalProducts.toLocaleString("es-AR")}
                </span>
              </div>
            )}
          </>
        )}
      </section>

      <StoreReviews storeId={store.id} />
    </div>
  );
};

export default StoreDetail;
