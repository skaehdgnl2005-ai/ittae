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
  setLevel(level: number): void;
}

interface KakaoMarkerInstance {
  setMap(map: KakaoMapInstance | null): void;
}

interface KakaoCircleInstance {
  setMap(map: KakaoMapInstance | null): void;
  setRadius(radius: number): void;
  setPosition(latlng: KakaoLatLng): void;
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
      Circle: new (options: {
        center: KakaoLatLng;
        radius: number;
        strokeWeight: number;
        strokeColor: string;
        strokeOpacity: number;
        strokeStyle: string;
        fillColor: string;
        fillOpacity: number;
      }) => KakaoCircleInstance;
    };
  };
};

type MapViewProps = {
  places: Place[];
  selectedPlaceId: string | null;
  center?: { lat: number; lng: number };
  radius?: number;
};

const DEFAULT_CENTER = { lat: 37.566535, lng: 126.9779692 };

const RADIUS_TO_LEVEL: Record<number, number> = {
  500: 4,
  1000: 5,
  2000: 6,
  3000: 7,
  5000: 8,
};

export function MapView({ places, selectedPlaceId, center, radius }: MapViewProps) {
  const { isLoaded } = useKakaoMap();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMapInstance | null>(null);
  const markersRef = useRef<KakaoMarkerInstance[]>([]);
  const circleRef = useRef<KakaoCircleInstance | null>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const lat = center?.lat ?? DEFAULT_CENTER.lat;
    const lng = center?.lng ?? DEFAULT_CENTER.lng;
    const centerLatLng = new window.kakao.maps.LatLng(lat, lng);

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.kakao.maps.Map(mapRef.current, {
        center: centerLatLng,
        level: RADIUS_TO_LEVEL[radius ?? 1000] ?? 5,
      });
    }

    const map = mapInstanceRef.current;
    map.panTo(centerLatLng);

    // 반경 원형 오버레이
    if (radius) {
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }
      circleRef.current = new window.kakao.maps.Circle({
        center: centerLatLng,
        radius,
        strokeWeight: 1,
        strokeColor: "#7c3aed",
        strokeOpacity: 0.4,
        strokeStyle: "solid",
        fillColor: "#ede9fe",
        fillOpacity: 0.25,
      });
      circleRef.current.setMap(map);
      map.setLevel(RADIUS_TO_LEVEL[radius] ?? 5);
    }

    // 마커 업데이트
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

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
  }, [isLoaded, places, selectedPlaceId, center, radius]);

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
