import { MemoryCard } from "./MemoryCard";
import type { Memory, Place } from "@/types";

type TimelineViewProps = {
  memories: Memory[];
  places: Place[];
};

export function TimelineView({ memories, places }: TimelineViewProps) {
  if (memories.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm text-gray-500">아직 완료된 모임이 없어요</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 relative">
      {/* 수직선 */}
      <div className="absolute left-[37px] top-4 bottom-4 w-px bg-gray-200" />
      <div className="space-y-4">
        {memories.map((memory) => (
          <div key={memory.id} className="flex gap-4">
            {/* 타임라인 도트 */}
            <div className="relative z-10 mt-4 shrink-0">
              <div className="w-4 h-4 rounded-full bg-white border-2 border-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <MemoryCard
                memory={memory}
                place={places.find((p) => p.id === memory.placeId)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
