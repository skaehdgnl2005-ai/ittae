"use client";

import { useMemo } from "react";
import { TIME_SLOTS, getTimeSlotHeatmap } from "@/lib/vote";
import { TimeColumn } from "./TimeColumn";
import { useDragSelect } from "@/hooks/useDragSelect";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import type { VoteChoice, TimeSlot } from "@/types";

type TimeGridProps = {
  dates: string[];
  dateChoices: Record<string, VoteChoice | null>;
  isSlotSelected: (date: string, time: string) => boolean;
  pendingStart: { date: string; time: string } | null;
  /** 다른 사람만 — 본인 selection은 별도로 그려진다 */
  othersTimeSlots: TimeSlot[];
  /** 다른 사람 총 수 (멤버 - 1) */
  othersTotal: number;
  peekMode: boolean;
  onPeekModeChange: (next: boolean) => void;
  onCellClick: (date: string, time: string) => void;
  onDragCommit: (slotIds: string[]) => void;
  onPeekClick: (date: string, time: string) => void;
};

export function TimeGrid({
  dates,
  dateChoices,
  isSlotSelected,
  pendingStart,
  othersTimeSlots,
  othersTotal,
  peekMode,
  onPeekModeChange,
  onCellClick,
  onDragCommit,
  onPeekClick,
}: TimeGridProps) {
  const { previewIds, isDragging, handlers, bindTarget } = useDragSelect({
    attribute: "data-slot",
    onConfirm: onDragCommit,
    holdDelay: 350,
  });

  const previewSlots = useMemo(() => new Set(previewIds), [previewIds]);

  const cellClick = peekMode ? onPeekClick : onCellClick;

  return (
    <div className="mx-5 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <p className="flex-1 text-xs text-gray-500 dark:text-gray-400">
          {peekMode
            ? "탭하면 누가 가능한지 볼 수 있어요"
            : "시간 선택 · 꾹 눌러서 드래그 또는 양끝 클릭"}
        </p>
        <button
          type="button"
          onClick={() => onPeekModeChange(!peekMode)}
          aria-pressed={peekMode}
          aria-label={peekMode ? "참고 모드 끄기" : "누가 가능한지 보기"}
          className={cn(
            "min-h-9 min-w-9 flex items-center justify-center rounded-lg transition-colors",
            peekMode
              ? "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
              : "text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800"
          )}
        >
          {peekMode ? (
            <Eye size={18} strokeWidth={1.75} />
          ) : (
            <EyeOff size={18} strokeWidth={1.75} />
          )}
        </button>
      </div>
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

        {/* 날짜별 시간 열 — touch-action:none은 hold가 발화해서 실제 드래그 모드로
            전환된 뒤에만 적용한다. 그 전(pending/idle)에는 native 스크롤이 살아 있어
            사용자가 셀 위에서도 위/아래 스와이프로 페이지를 굴릴 수 있다. */}
        <div
          ref={peekMode ? undefined : bindTarget}
          className={cn(
            "flex flex-1 gap-1 select-none",
            !peekMode && isDragging && "touch-none",
            !peekMode && isDragging && "cursor-grabbing"
          )}
          {...(peekMode ? {} : handlers)}
        >
          {dates.map((date) => {
            const choice = dateChoices[date];
            const disabled = choice !== "available";
            const othersHeatmap = getTimeSlotHeatmap(othersTimeSlots, date);

            return (
              <div key={date} className="flex-1">
                <TimeColumn
                  date={date}
                  disabled={disabled}
                  isSlotSelected={isSlotSelected}
                  pendingStart={pendingStart}
                  previewSlots={previewSlots}
                  othersHeatmap={othersHeatmap}
                  othersTotal={othersTotal}
                  peekMode={peekMode}
                  onCellClick={cellClick}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
