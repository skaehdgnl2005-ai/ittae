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
  onClick: () => void;
};

/**
 * 비율(count/total) 기반 히트맵 색.
 * 항상 표시되며, 0명일 때도 자체 배경색을 가진다.
 */
function getHeatmapClass(count: number, total: number): string {
  if (count === 0 || total === 0) {
    return "bg-gray-50 dark:bg-gray-800/60";
  }
  if (count >= total) {
    return "bg-violet-700 dark:bg-violet-600";
  }
  const ratio = count / total;
  if (ratio >= 0.75) return "bg-violet-500 dark:bg-violet-500";
  if (ratio >= 0.5) return "bg-violet-400 dark:bg-violet-400";
  if (ratio >= 0.25) return "bg-violet-200 dark:bg-violet-700/50";
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

  const heatmapClass = getHeatmapClass(heatCount, totalMembers);

  return (
    <button
      onClick={onClick}
      data-slot={`${date}T${time}`}
      aria-label={`${time} ${selected ? "선택됨" : "미선택"}, 가능 인원 ${heatCount}명`}
      aria-pressed={selected}
      className={cn(
        "h-8 w-full transition-colors border-b border-gray-100 dark:border-gray-800 relative",
        heatmapClass,
        // 내 선택 표식: 진한 violet ring으로 다른 색 위에서도 잘 보임
        selected && "ring-[3px] ring-inset ring-violet-700 dark:ring-violet-300",
        // pending start: 시작점 강조
        isPendingStart &&
          !selected &&
          "ring-2 ring-inset ring-violet-500 dark:ring-violet-400",
        // 드래그 미리보기: 위에 살짝 어두운 violet
        isPreview && "bg-violet-300/70 dark:bg-violet-600/60",
        // 호버: 빈 칸일 때만 약간 violet hue
        !selected && !isPreview && !isPendingStart && heatCount === 0
          ? "hover:bg-violet-50 dark:hover:bg-violet-900/20"
          : null
      )}
    />
  );
}
