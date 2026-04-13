"use client";
import { useState, useCallback } from "react";
import { KakaoMapProvider } from "@/components/map/KakaoMapProvider";
import { MapView } from "@/components/map/MapView";
import { CategoryFilterBar } from "@/components/map/CategoryFilterBar";
import { RadiusSlider } from "@/components/map/RadiusSlider";
import { PlaceCardCarousel } from "@/components/map/PlaceCardCarousel";
import { KakaoShareButton } from "@/components/map/KakaoShareButton";
import type { KakaoPlace } from "@/types";

type Category = "FD6" | "CE7" | "SW8";

const DEFAULT_CENTER = { x: "126.9779692", y: "37.566535" };

const CATEGORY_KEYWORDS: Record<Category, string> = {
  FD6: "음식점",
  CE7: "카페",
  SW8: "지하철",
};

export default function MapPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [radius, setRadius] = useState(1000);
  const [places, setPlaces] = useState<KakaoPlace[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedPlace = places.find((p) => p.kakaoPlaceId === selectedPlaceId) ?? null;

  const fetchPlaces = useCallback(async (category: Category | null, searchRadius: number) => {
    if (!category) {
      setPlaces([]);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        query: CATEGORY_KEYWORDS[category],
        category_group_code: category,
        x: DEFAULT_CENTER.x,
        y: DEFAULT_CENTER.y,
        radius: String(searchRadius),
      });

      const res = await fetch(`/api/places/search?${params.toString()}`);
      if (!res.ok) return;
      const json: { data: KakaoPlace[] } = await res.json();
      setPlaces(json.data ?? []);
      setSelectedPlaceId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCategorySelect = (category: Category | null) => {
    setSelectedCategory(category);
    fetchPlaces(category, radius);
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (selectedCategory) {
      fetchPlaces(selectedCategory, newRadius);
    }
  };

  const handlePlaceSelect = async (kakaoPlaceId: string) => {
    setSelectedPlaceId(kakaoPlaceId);
    const place = places.find((p) => p.kakaoPlaceId === kakaoPlaceId);
    if (!place) return;

    await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kakaoPlaceId: place.kakaoPlaceId,
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        categoryCode: place.categoryCode,
      }),
    });
  };

  const kakaoPlacesAsPlace = places.map((p) => ({
    id: p.kakaoPlaceId,
    name: p.name,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    category: (p.categoryCode || "FD6") as "FD6" | "CE7" | "SW8",
    rating: 0,
    imageUrl: null,
  }));

  return (
    <KakaoMapProvider>
      <div className="flex flex-col h-dvh">
        <div className="bg-white border-b border-gray-200 z-10">
          <CategoryFilterBar selected={selectedCategory} onSelect={handleCategorySelect} />
        </div>

        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
              <p className="text-sm text-gray-500">장소 검색 중...</p>
            </div>
          )}
          <MapView
            places={kakaoPlacesAsPlace}
            selectedPlaceId={selectedPlaceId}
          />
        </div>

        <div className="bg-white border-t border-gray-200 pb-[83px]">
          <RadiusSlider value={radius} onChange={handleRadiusChange} />
          <PlaceCardCarousel
            places={kakaoPlacesAsPlace}
            selectedId={selectedPlaceId}
            onSelect={handlePlaceSelect}
          />
          {selectedPlace && (
            <div className="px-5 pb-3">
              <KakaoShareButton
                place={{
                  name: selectedPlace.name,
                  address: selectedPlace.address,
                  latitude: selectedPlace.latitude,
                  longitude: selectedPlace.longitude,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </KakaoMapProvider>
  );
}
