"use client";
import { useState } from "react";
import { KakaoMapProvider } from "@/components/map/KakaoMapProvider";
import { MapView } from "@/components/map/MapView";
import { CategoryFilterBar } from "@/components/map/CategoryFilterBar";
import { RadiusSlider } from "@/components/map/RadiusSlider";
import { PlaceCardCarousel } from "@/components/map/PlaceCardCarousel";
import { mockPlaces } from "@/lib/mock";

type Category = "FD6" | "CE7" | "SW8";

export default function MapPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [radius, setRadius] = useState(1000);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const filteredPlaces = selectedCategory
    ? mockPlaces.filter((p) => p.category === selectedCategory)
    : mockPlaces;

  return (
    <KakaoMapProvider>
      <div className="flex flex-col h-dvh">
        {/* 상단 필터바 */}
        <div className="bg-white border-b border-gray-200 z-10">
          <CategoryFilterBar selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>

        {/* 지도 */}
        <div className="flex-1 relative">
          <MapView
            places={filteredPlaces}
            selectedPlaceId={selectedPlaceId}
          />
        </div>

        {/* 하단 시트 */}
        <div className="bg-white border-t border-gray-200 pb-[83px]">
          <RadiusSlider value={radius} onChange={setRadius} />
          <PlaceCardCarousel
            places={filteredPlaces}
            selectedId={selectedPlaceId}
            onSelect={setSelectedPlaceId}
          />
        </div>
      </div>
    </KakaoMapProvider>
  );
}
