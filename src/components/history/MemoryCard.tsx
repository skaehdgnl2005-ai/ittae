import { MapPin } from "lucide-react";
import { AvatarGroup } from "@/components/ui/Avatar";
import type { Memory, Place } from "@/types";

type MemoryCardProps = {
  memory: Memory;
  place: Place | undefined;
};

export function MemoryCard({ memory, place }: MemoryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {memory.photos.length > 0 && (
        <div className="w-full h-32 bg-gray-100" />
      )}
      <div className="p-4">
        <p className="text-xs font-medium text-gray-400">{memory.date}</p>
        {place && (
          <div className="flex items-center gap-1 mt-1">
            <MapPin size={12} className="text-gray-400" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-gray-800">{place.name}</p>
          </div>
        )}
        {memory.note && (
          <p className="text-xs text-gray-500 mt-2">{memory.note}</p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <AvatarGroup users={memory.participants} max={4} />
          <span className="text-xs text-gray-400">{memory.participants.length}명</span>
        </div>
      </div>
    </div>
  );
}
