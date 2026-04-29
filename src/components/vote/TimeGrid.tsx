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
  /** 다른 사람만 — 본인 selection은 별도로 그려진다 */
  othersTimeSlots: TimeSlot[];
  /** 다른 사람 총 수 (멤버 - 1) */
  othersTotal: number;
  onCellClick: (date: string, time: string) => void;
  onDragCommit: (slotIds: string[]) => void;
};

export function TimeGrid({
  dates,
  dateChoices,
  isSlotSelected,
  pendingStart,
  othersTimeSlots,
  othersTotal,
  onCellClick,
  onDragCommit,
}: TimeGridProps) {
  const { previewIds, isDragging, handlers, bindTarget } = useDragSelect({
    attribute: "data-slot",
    onConfirm: onDragCommit,
    holdDelay: 350,
  });

  const previewSlots = useMemo(() => new Set(previewIds), [previewIds]);

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

        {/* 날짜별 시간 열 — 모바일에서 hold→drag 시 페이지 스크롤이 끼어들지 않도록
            컨테이너 자체에 항상 touch-action:none을 적용한다. 페이지 스크롤은
            그리드 바깥(시간 라벨 영역, 헤더, 위·아래 패딩)에서 그대로 가능. */}
        <div
          ref={bindTarget}
          className={cn(
            "flex flex-1 gap-1 select-none touch-none",
            isDragging && "cursor-grabbing"
          )}
          {...handlers}
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
