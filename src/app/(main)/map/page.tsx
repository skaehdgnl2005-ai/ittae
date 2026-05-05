"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { LocateFixed } from "lucide-react";
import { KakaoMapProvider } from "@/components/map/KakaoMapProvider";
import { MapView } from "@/components/map/MapView";
import { CategoryFilterBar } from "@/components/map/CategoryFilterBar";
import { RadiusSlider } from "@/components/map/RadiusSlider";
import { PlaceCardCarousel } from "@/components/map/PlaceCardCarousel";
import { KakaoShareButton } from "@/components/map/KakaoShareButton";
import { useGeolocation } from "@/hooks/useGeolocation";
import { cn } from "@/lib/utils";
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
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const centerRef = useRef(DEFAULT_CENTER);

  const fetchPlaces = useCallback(async (
    category: Category | null,
    searchRadius: number,
    searchCenter?: { x: string; y: string },
  ) => {
    const c = searchCenter ?? centerRef.current;
    if (!category) {
      setPlaces([]);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        query: CATEGORY_KEYWORDS[category],
        category_group_code: category,
        x: c.x,
        y: c.y,
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

  const categoryRef = useRef(selectedCategory);
  categoryRef.current = selectedCategory;
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  const handleGeoSuccess = useCallback((coords: { lat: number; lng: number }) => {
    const newCenter = { x: String(coords.lng), y: String(coords.lat) };
    centerRef.current = newCenter;
    setCenter(newCenter);
    if (categoryRef.current) {
      fetchPlaces(categoryRef.current, radiusRef.current, newCenter);
    }
  }, [fetchPlaces]);

  const { loading: geoLoading, error: geoError, requestLocation } = useGeolocation(handleGeoSuccess);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const selectedPlace = places.find((p) => p.kakaoPlaceId === selectedPlaceId) ?? null;

  const handleCategorySelect = (category: Category | null) => {
    setSelectedCategory(category);
    categoryRef.current = category;
    fetchPlaces(category, radius);
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    radiusRef.current = newRadius;
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
            center={{ lat: Number(center.y), lng: Number(center.x) }}
            radius={radius}
          />
          <button
            onClick={requestLocation}
            disabled={geoLoading}
            aria-label="내 위치로 이동"
            className={cn(
              "absolute right-4 bottom-4 z-10 w-11 h-11 flex items-center justify-center",
              "rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
              "shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all",
            )}
          >
            <LocateFixed
              size={20}
              strokeWidth={1.5}
              className={cn(
                geoLoading ? "animate-pulse text-violet-600" : "text-gray-700 dark:text-gray-300",
              )}
            />
          </button>
          {geoError && (
            <div className="absolute left-4 right-4 bottom-16 z-10 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 text-center">
              {geoError}
            </div>
          )}
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
