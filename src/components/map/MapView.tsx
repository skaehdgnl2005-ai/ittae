"use client";
import { useEffect, useRef } from "react";
import { useKakaoMap } from "./KakaoMapProvider";
import { MapPin } from "lucide-react";
import type { Place } from "@/types";

type MapViewProps = {
  places: Place[];
  selectedPlaceId: string | null;
  center?: { lat: number; lng: number };
};

export function MapView({ places, selectedPlaceId, center }: MapViewProps) {
  const { isLoaded } = useKakaoMap();
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    // Phase 2: 실제 Kakao Maps 렌더링
  }, [isLoaded, places, selectedPlaceId, center]);

  return (
    <div ref={mapRef} className="w-full h-full relative bg-gray-100">
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
          <MapPin size={32} strokeWidth={1.5} />
          <p className="text-sm">지도 로딩 중...</p>
          <p className="text-xs text-gray-300">NEXT_PUBLIC_KAKAO_MAP_KEY 설정 필요</p>
        </div>
      )}
    </div>
  );
}
