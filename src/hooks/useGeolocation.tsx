import { useState, useEffect } from "react";

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

const ROSARIO_FALLBACK = {
  latitude: -32.94682,
  longitude: -60.63932,
};

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({
        latitude: ROSARIO_FALLBACK.latitude,
        longitude: ROSARIO_FALLBACK.longitude,
        error: "Geolocalización no soportada por el navegador",
        loading: false,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (error) => {
        console.warn("Ubicación GPS no disponible o rechazada. Usando Rosario:", error.message);
        setState({
          latitude: ROSARIO_FALLBACK.latitude,
          longitude: ROSARIO_FALLBACK.longitude,
          error: error.message,
          loading: false,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  return state;
};