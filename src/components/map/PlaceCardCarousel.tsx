"use client";
import { cn } from "@/lib/utils";
import { MapPin, Star } from "lucide-react";
import type { Place } from "@/types";

type PlaceCardCarouselProps = {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function PlaceCardCarousel({ places, selectedId, onSelect }: PlaceCardCarouselProps) {
  return (
    <div className="flex gap-3 px-5 py-3 overflow-x-auto no-scrollbar">
      {places.map((place) => (
        <button
          key={place.id}
          onClick={() => onSelect(place.id)}
          className={cn(
            "shrink-0 w-48 bg-white rounded-xl border p-3 text-left transition-all",
            selectedId === place.id
              ? "border-violet-600 ring-1 ring-violet-600"
              : "border-gray-200"
          )}
        >
          <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
            <MapPin size={20} className="text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{place.name}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{place.address}</p>
          <div className="flex items-center gap-1 mt-1">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            <span className="text-xs text-gray-500">{place.rating}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
