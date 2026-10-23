import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, MapPin, Navigation, ArrowLeft, Crosshair, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface MapViewProps {
  stores?: any[];
  onClose?: () => void;
}

const ROSARIO_CENTER = { lat: -32.94682, lng: -60.63932 };

// Colores según cadena de supermercado
const getStoreColor = (name: string = "") => {
  const lower = name.toLowerCase();
  if (lower.includes("coto")) return "#dc2626"; // Rojo
  if (lower.includes("carrefour")) return "#2563eb"; // Azul
  if (lower.includes("jumbo")) return "#16a34a"; // Verde
  if (lower.includes("gallega")) return "#ea580c"; // Naranja
  if (lower.includes("reina")) return "#9333ea"; // Púrpura
  return "#e11d48"; // Color primario por defecto
};

const MapView = ({ stores = [], onClose }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!mapContainer.current) return;

    // Inicializar mapa centrado en Rosario por defecto
    const map = L.map(mapContainer.current, {
      center: [ROSARIO_CENTER.lat, ROSARIO_CENTER.lng],
      zoom: 13,
      zoomControl: true,
    });

    mapInstance.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Ajustar tamaño exacto del canvas de Leaflet tras renderizar
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    // Solicitar GPS de alta precisión
    if (navigator.geolocation) {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLoading(false);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserPos({ lat, lng });

          // Pin azul del usuario con ancla exacta al centro (10, 10)
          const userIcon = L.divIcon({
            className: "custom-user-pin",
            html: `
              <div style="position: relative; width: 20px; height: 20px;">
                <div style="position: absolute; width: 20px; height: 20px; background-color: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px rgba(59,130,246,0.8); z-index: 2;"></div>
                <div style="position: absolute; width: 40px; height: 40px; top: -10px; left: -10px; background-color: rgba(59,130,246,0.25); border-radius: 50%; animation: pulse 2s infinite;"></div>
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10],
          });

          L.marker([lat, lng], { icon: userIcon })
            .addTo(map)
            .bindPopup("<b>📍 Tu ubicación actual</b>");

          map.setView([lat, lng], 14);
        },
        (err) => {
          setGpsLoading(false);
          console.warn("GPS no otorgado o no disponible:", err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    // Agregar pines de las sucursales con coordenadas exactas
    stores.forEach((store) => {
      const lat = Number(store.latitude);
      const lng = Number(store.longitude);

      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

      const color = getStoreColor(store.name);

      // Icono con ancla en la punta inferior (14, 34)
      const storeIcon = L.divIcon({
        className: "custom-store-pin",
        html: `
          <div style="
            background-color: ${color};
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          ">
            <div style="transform: rotate(45deg); font-weight: bold; font-size: 13px;">🛒</div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32], // Ancla la punta inferior exactamente sobre el punto GPS
        popupAnchor: [0, -32],
      });

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 180px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #1e293b;">${store.name}</h4>
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.3;">
            📍 ${store.address || "Rosario, Santa Fe"}
          </p>
          ${
            store.distance !== undefined && store.distance !== null
              ? `<span style="display: inline-block; background: #eff6ff; color: #2563eb; font-weight: 600; font-size: 11px; padding: 2px 8px; border-radius: 12px;">
                  🚀 A ${Number(store.distance).toFixed(1)} km de ti
                </span>`
              : ""
          }
        </div>
      `;

      L.marker([lat, lng], { icon: storeIcon })
        .addTo(map)
        .bindPopup(popupHtml);
    });

    return () => {
      clearTimeout(timer);
      map.remove();
    };
  }, [stores]);

  // Centrar en usuario o en Rosario Centro
  const centerOnUser = () => {
    if (userPos && mapInstance.current) {
      mapInstance.current.setView([userPos.lat, userPos.lng], 15);
    } else if (mapInstance.current) {
      mapInstance.current.setView([ROSARIO_CENTER.lat, ROSARIO_CENTER.lng], 14);
    }
  };

  const centerOnRosario = () => {
    if (mapInstance.current) {
      mapInstance.current.setView([ROSARIO_CENTER.lat, ROSARIO_CENTER.lng], 13);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="h-16 border-b px-4 flex items-center justify-between bg-white z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-base flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" /> Tiendas cercanas
            </h1>
            <p className="text-xs text-muted-foreground">
              {stores.length} sucursales en Rosario y alrededores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={centerOnRosario} className="text-xs hidden sm:flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> Rosario Centro
          </Button>
          <Button variant="default" size="sm" onClick={centerOnUser} className="text-xs flex items-center gap-1">
            <Crosshair className="w-3.5 h-3.5" /> {userPos ? "Mi Ubicación" : "Centrar GPS"}
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />
      </div>
    </div>
  );
};

export default MapView;