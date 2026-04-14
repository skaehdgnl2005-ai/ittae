"use client";
import { useEffect, useRef } from "react";
import { useKakaoMap } from "./KakaoMapProvider";
import { MapPin } from "lucide-react";
import type { Place } from "@/types";

interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

interface KakaoMapInstance {
  setCenter(latlng: KakaoLatLng): void;
  panTo(latlng: KakaoLatLng): void;
}

interface KakaoMarkerInstance {
  setMap(map: KakaoMapInstance | null): void;
}

declare const window: Window & {
  kakao: {
    maps: {
      Map: new (
        container: HTMLElement,
        options: { center: KakaoLatLng; level: number },
      ) => KakaoMapInstance;
      LatLng: new (lat: number, lng: number) => KakaoLatLng;
      Marker: new (options: {
        position: KakaoLatLng;
        map: KakaoMapInstance;
      }) => KakaoMarkerInstance;
    };
  };
};

type MapViewProps = {
  places: Place[];
  selectedPlaceId: string | null;
  center?: { lat: number; lng: number };
};

const DEFAULT_CENTER = { lat: 37.566535, lng: 126.9779692 };

export function MapView({ places, selectedPlaceId, center }: MapViewProps) {
  const { isLoaded } = useKakaoMap();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMapInstance | null>(null);
  const markersRef = useRef<KakaoMarkerInstance[]>([]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      const lat = center?.lat ?? DEFAULT_CENTER.lat;
      const lng = center?.lng ?? DEFAULT_CENTER.lng;
      mapInstanceRef.current = new window.kakao.maps.Map(mapRef.current, {
        center: new window.kakao.maps.LatLng(lat, lng),
        level: 5,
      });
    }

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const map = mapInstanceRef.current;
    for (const place of places) {
      const pos = new window.kakao.maps.LatLng(place.latitude, place.longitude);
      markersRef.current.push(new window.kakao.maps.Marker({ position: pos, map }));
    }

    if (selectedPlaceId) {
      const selected = places.find((p) => p.id === selectedPlaceId);
      if (selected) {
        map.panTo(
          new window.kakao.maps.LatLng(selected.latitude, selected.longitude),
        );
      }
    }
  }, [isLoaded, places, selectedPlaceId, center]);

  return (
    <div ref={mapRef} className="w-full h-full relative">
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-100 text-gray-400">
          <MapPin size={32} strokeWidth={1.5} />
          <p className="text-sm">지도 로딩 중...</p>
        </div>
      )}
    </div>
  );
}
