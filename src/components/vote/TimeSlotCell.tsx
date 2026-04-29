"use client";

import { cn } from "@/lib/utils";

type TimeSlotCellProps = {
  date: string;
  time: string;
  disabled: boolean;
  selected: boolean;
  isPendingStart: boolean;
  isPreview: boolean;
  /** 다른 사람들 가용 인원 수 (본인 제외) */
  othersCount: number;
  /** 다른 사람 총 수 (본인 제외 = 멤버 - 1) */
  othersTotal: number;
  onClick: () => void;
};

/**
 * 다른 사람만 카운트한 히트맵.
 * 본인 selection 색(violet-700)보다 항상 연하게 — When2meet의 "Group's Availability" 색조에 대응.
 */
function getOthersHeatmapClass(count: number, total: number): string {
  if (count === 0 || total === 0) {
    return "bg-gray-50 dark:bg-gray-800/60";
  }
  const ratio = count / total;
  if (ratio >= 1) return "bg-violet-400 dark:bg-violet-700/55";
  if (ratio >= 0.75) return "bg-violet-300 dark:bg-violet-800/55";
  if (ratio >= 0.5) return "bg-violet-200 dark:bg-violet-800/45";
  if (ratio >= 0.25) return "bg-violet-100 dark:bg-violet-900/55";
  return "bg-violet-50 dark:bg-violet-900/35";
}

export function TimeSlotCell({
  date,
  time,
  disabled,
  selected,
  isPendingStart,
  isPreview,
  othersCount,
  othersTotal,
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

  // 본인 선택은 항상 가장 진한 색. 본인 색은 다른 사람 max 색보다 진하다(violet-700 > violet-400).
  const baseClass = selected
    ? "bg-violet-700 dark:bg-violet-500"
    : getOthersHeatmapClass(othersCount, othersTotal);

  return (
    <button
      onClick={onClick}
      data-slot={`${date}T${time}`}
      aria-label={`${time} ${selected ? "선택됨" : "미선택"}, 다른 사람 ${othersCount}/${othersTotal}명 가능`}
      aria-pressed={selected}
      className={cn(
        "h-8 w-full transition-colors border-b border-gray-100 dark:border-gray-800 relative",
        baseClass,
        // pending start: 시작점 강조
        isPendingStart &&
          !selected &&
          "ring-2 ring-inset ring-violet-500 dark:ring-violet-400",
        // 드래그 미리보기: 본인 색의 약한 버전
        isPreview && "bg-violet-500/80 dark:bg-violet-500/70",
        // 호버: 빈 칸일 때만 약간 violet hue
        !selected && !isPreview && !isPendingStart && othersCount === 0
          ? "hover:bg-violet-100 dark:hover:bg-violet-900/30"
          : null
      )}
    />
  );
}
