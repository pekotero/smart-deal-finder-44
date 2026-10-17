import { useState, useEffect } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Tu navegador no soporta geolocalización",
        loading: false,
      }));
      return;
    }

    const success = (position: GeolocationPosition) => {
      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        error: null,
        loading: false,
      });
    };

    const error = (err: GeolocationPositionError) => {
      let errorMessage = "Error al obtener ubicación";
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = "Permiso de ubicación denegado";
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = "Ubicación no disponible";
          break;
        case err.TIMEOUT:
          errorMessage = "Tiempo de espera agotado";
          break;
      }
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    };

    navigator.geolocation.getCurrentPosition(success, error, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  }, []);

  return state;
};

// Calculate distance between two coordinates in km
export const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
