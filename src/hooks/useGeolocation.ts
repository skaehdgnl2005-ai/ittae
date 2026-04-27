"use client";
import { useState, useCallback } from "react";

type Coords = { lat: number; lng: number };

type GeolocationState = {
  loading: boolean;
  error: string | null;
};

export function useGeolocation(onSuccess: (coords: Coords) => void) {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ loading: false, error: "이 브라우저에서는 위치 기능을 지원하지 않아요." });
      return;
    }

    setState({ loading: true, error: null });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({ loading: false, error: null });
        onSuccess({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 거부되었어요. 브라우저 설정에서 허용해주세요."
            : "위치를 가져올 수 없어요. 다시 시도해주세요.";
        setState({ loading: false, error: message });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [onSuccess]);

  return { ...state, requestLocation };
}
