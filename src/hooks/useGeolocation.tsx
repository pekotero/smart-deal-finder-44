import { useState, useEffect, useCallback } from "react";

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
  // true = no se pudo obtener la ubicación y se está usando el centro de Rosario.
  isFallback: boolean;
  // true = el navegador tiene bloqueado el permiso de ubicación para este sitio.
  denied: boolean;
}

const ROSARIO_FALLBACK = {
  latitude: -32.94682,
  longitude: -60.63932,
};

const getPosition = (options: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options),
  );

const reason = (e: GeolocationPositionError | null) => {
  if (!e) return "Tu navegador no permite obtener la ubicación.";
  if (e.code === e.PERMISSION_DENIED) return "El permiso de ubicación está bloqueado para este sitio.";
  if (e.code === e.TIMEOUT) return "Tu ubicación tardó demasiado en llegar.";
  return "No se pudo obtener tu ubicación.";
};

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
    isFallback: false,
    denied: false,
  });

  const locate = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const fallback = (e: GeolocationPositionError | null) => {
      console.warn("Ubicación no disponible, usando Rosario:", e?.message ?? "sin geolocalización");
      setState({
        latitude: ROSARIO_FALLBACK.latitude,
        longitude: ROSARIO_FALLBACK.longitude,
        error: reason(e),
        loading: false,
        isFallback: true,
        denied: e?.code === 1,
      });
    };

    // Sin HTTPS el navegador no da la ubicación (localhost sí funciona).
    if (!navigator.geolocation || !window.isSecureContext) return fallback(null);

    const ok = (p: GeolocationPosition) =>
      setState({
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        error: null,
        loading: false,
        isFallback: false,
        denied: false,
      });

    try {
      // GPS preciso primero (celular). En PC o adentro de edificios suele no responder a tiempo.
      ok(await getPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }));
    } catch (e) {
      const err = e as GeolocationPositionError;
      if (err.code === err.PERMISSION_DENIED) return fallback(err);
      try {
        // Reintento con la ubicación aproximada por Wi-Fi / red, que es más rápida.
        ok(await getPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60000 }));
      } catch (e2) {
        fallback(e2 as GeolocationPositionError);
      }
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  return { ...state, retry: locate };
};

// Distancia en km entre dos puntos (fórmula de Haversine). La usa la ficha de cada tienda.
export const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
