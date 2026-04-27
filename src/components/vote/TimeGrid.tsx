"use client";

import { useMemo } from "react";
import { TIME_SLOTS, getTimeSlotHeatmap } from "@/lib/vote";
import { TimeColumn } from "./TimeColumn";
import { useDragSelect } from "@/hooks/useDragSelect";
import { cn } from "@/lib/utils";
import type { VoteChoice, TimeSlot } from "@/types";

type TimeGridProps = {
  dates: string[];
  dateChoices: Record<string, VoteChoice | null>;
  isSlotSelected: (date: string, time: string) => boolean;
  pendingStart: { date: string; time: string } | null;
  allTimeSlots: TimeSlot[];
  totalMembers: number;
  showHeatmap: boolean;
  onCellClick: (date: string, time: string) => void;
  onDragCommit: (slotIds: string[]) => void;
};

export function TimeGrid({
  dates,
  dateChoices,
  isSlotSelected,
  pendingStart,
  allTimeSlots,
  totalMembers,
  showHeatmap,
  onCellClick,
  onDragCommit,
}: TimeGridProps) {
  const { previewIds, isDragging, handlers, bindTarget } = useDragSelect({
    attribute: "data-slot",
    onConfirm: onDragCommit,
    holdDelay: 350,
  });

  const previewSlots = useMemo(() => new Set(previewIds), [previewIds]);
  const dragEnabled = !showHeatmap;

  return (
    <div className="mx-5 mt-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        시간 선택 · 꾹 눌러서 드래그 또는 양끝 클릭
      </p>
      <div className="flex gap-0">
        {/* 시간 라벨 열 */}
        <div className="flex-shrink-0 w-12 pt-5">
          {TIME_SLOTS.map((time) => (
            <div
              key={time}
              className="h-8 flex items-center text-xs text-gray-400 dark:text-gray-500"
            >
              {time}
            </div>
          ))}
        </div>

        {/* 날짜별 시간 열 */}
        <div
          ref={dragEnabled ? bindTarget : undefined}
          className={cn(
            "flex flex-1 gap-1 select-none",
            dragEnabled && "touch-pan-y",
            isDragging && "touch-none cursor-grabbing"
          )}
          {...(dragEnabled ? handlers : {})}
        >
          {dates.map((date) => {
            const choice = dateChoices[date];
            const disabled = choice !== "available";
            const heatmap = showHeatmap
              ? getTimeSlotHeatmap(allTimeSlots, date)
              : {};

            return (
              <div key={date} className="flex-1">
                <TimeColumn
                  date={date}
                  disabled={disabled}
                  isSlotSelected={isSlotSelected}
                  pendingStart={pendingStart}
                  previewSlots={previewSlots}
                  heatmap={heatmap}
                  totalMembers={totalMembers}
                  showHeatmap={showHeatmap}
                  onCellClick={onCellClick}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
