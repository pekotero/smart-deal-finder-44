import { useEffect, useMemo, useRef, useState } from "react";
import { Store } from "@/hooks/useStores";
import { MapPin, Navigation, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import StoreCard from "./StoreCard";
import { useGeolocation, calculateDistanceKm } from "@/hooks/useGeolocation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Leaflet with React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom user location icon
const userIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Store location icon
const storeIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface StoreWithDistance extends Store {
  calculatedDistance?: number;
}

interface MapViewProps {
  stores: Store[];
  onClose: () => void;
}

const MapView = ({ stores, onClose }: MapViewProps) => {
  const { latitude, longitude, error, loading } = useGeolocation();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);

  // Sort stores by distance from user
  const sortedStores = useMemo((): StoreWithDistance[] => {
    if (!latitude || !longitude) return stores;

    return [...stores]
      .filter((store) => store.latitude && store.longitude)
      .map((store) => ({
        ...store,
        calculatedDistance: calculateDistanceKm(
          latitude,
          longitude,
          store.latitude!,
          store.longitude!
        ),
      }))
      .sort((a, b) => (a.calculatedDistance ?? 0) - (b.calculatedDistance ?? 0));
  }, [stores, latitude, longitude]);

  // Default center (Mexico City) if no user location
  const defaultCenter: [number, number] = [19.4326, -99.1332];
  const center: [number, number] =
    latitude && longitude ? [latitude, longitude] : defaultCenter;

  // Initialize map using vanilla Leaflet
  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(center, 13);
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading]);

  // Update map center when user location changes
  useEffect(() => {
    if (mapRef.current && latitude && longitude) {
      mapRef.current.setView([latitude, longitude], 13);
    }
  }, [latitude, longitude]);

  // Add user marker
  useEffect(() => {
    if (!mapRef.current || !latitude || !longitude || !mapReady) return;

    const marker = L.marker([latitude, longitude], { icon: userIcon })
      .addTo(mapRef.current)
      .bindPopup(`
        <div class="text-center">
          <p class="font-medium">Tu ubicación</p>
        </div>
      `);

    return () => {
      marker.remove();
    };
  }, [latitude, longitude, mapReady]);

  // Add store markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const markers: L.Marker[] = [];

    sortedStores.forEach((store) => {
      if (store.latitude && store.longitude) {
        const marker = L.marker([store.latitude, store.longitude], { icon: storeIcon })
          .addTo(mapRef.current!)
          .bindPopup(`
            <div class="min-w-[150px]">
              <p class="font-medium">${store.name}</p>
              <p class="text-sm text-gray-500">${store.address || ""}</p>
              ${store.calculatedDistance !== undefined 
                ? `<p class="text-sm text-blue-600 font-medium mt-1">${store.calculatedDistance.toFixed(1)} km</p>` 
                : ""}
            </div>
          `);
        markers.push(marker);
      }
    });

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [sortedStores, mapReady]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-card/95 backdrop-blur-md border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Tiendas cercanas</h2>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Obteniendo ubicación..."
                  : error
                  ? error
                  : `${sortedStores.length} tiendas encontradas`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="absolute inset-0 pt-[72px]">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Obteniendo tu ubicación...</p>
            </div>
          </div>
        ) : (
          <div 
            ref={mapContainerRef} 
            className="w-full h-full"
            style={{ height: "100%", width: "100%" }}
          />
        )}
      </div>

      {/* Error message */}
      {error && !loading && (
        <div className="absolute top-20 left-4 right-4 z-[1000] bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Store list drawer */}
      <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-lg max-h-[40vh] overflow-hidden z-[1000]">
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-3" />
        <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(40vh-2rem)]">
          {sortedStores.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay tiendas con ubicación disponible
            </p>
          ) : (
            sortedStores.map((store) => (
              <StoreCard
                key={store.id}
                {...store}
                distance={
                  store.calculatedDistance !== undefined
                    ? `${store.calculatedDistance.toFixed(1)} km`
                    : store.distance
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MapView;
