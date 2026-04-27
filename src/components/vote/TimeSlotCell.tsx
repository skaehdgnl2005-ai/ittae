"use client";

import { cn } from "@/lib/utils";

type TimeSlotCellProps = {
  date: string;
  time: string;
  disabled: boolean;
  selected: boolean;
  isPendingStart: boolean;
  isPreview: boolean;
  heatCount: number;
  totalMembers: number;
  showHeatmap: boolean;
  onClick: () => void;
};

function getHeatmapClass(count: number, total: number): string {
  if (count === 0) return "bg-gray-100 dark:bg-gray-800";
  if (count === total) return "bg-violet-700 dark:bg-violet-600";
  if (count >= 3) return "bg-violet-500 dark:bg-violet-500";
  if (count >= 2) return "bg-violet-300 dark:bg-violet-400";
  return "bg-violet-100 dark:bg-violet-900/40";
}

export function TimeSlotCell({
  date,
  time,
  disabled,
  selected,
  isPendingStart,
  isPreview,
  heatCount,
  totalMembers,
  showHeatmap,
  onClick,
}: TimeSlotCellProps) {
  if (disabled) {
    return (
      <div
        className="h-8 bg-gray-200 dark:bg-gray-700 opacity-35"
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={showHeatmap}
      data-slot={showHeatmap ? undefined : `${date}T${time}`}
      aria-label={`${time} ${selected ? "선택됨" : "미선택"}`}
      className={cn(
        "h-8 w-full transition-colors border-b border-gray-100 dark:border-gray-800",
        showHeatmap
          ? getHeatmapClass(heatCount, totalMembers)
          : selected
            ? "bg-violet-500 dark:bg-violet-600"
            : isPreview
              ? "bg-violet-200 dark:bg-violet-500/40"
              : isPendingStart
                ? "bg-violet-300 ring-2 ring-violet-500 dark:bg-violet-400"
                : "bg-white hover:bg-violet-50 dark:bg-gray-900 dark:hover:bg-violet-900/20"
      )}
    />
  );
}
