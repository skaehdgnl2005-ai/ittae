"use client";

import { TIME_SLOTS } from "@/lib/vote";
import { TimeSlotCell } from "./TimeSlotCell";
import { cn } from "@/lib/utils";

type TimeColumnProps = {
  date: string;
  disabled: boolean;
  isSlotSelected: (date: string, time: string) => boolean;
  pendingStart: { date: string; time: string } | null;
  previewSlots: Set<string>;
  /** 다른 사람만 카운트한 시간대별 가용 인원 (본인 제외) */
  othersHeatmap: Record<string, number>;
  /** 다른 사람 총 수 (멤버 - 1) */
  othersTotal: number;
  onCellClick: (date: string, time: string) => void;
};

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TimeColumn({
  date,
  disabled,
  isSlotSelected,
  pendingStart,
  previewSlots,
  othersHeatmap,
  othersTotal,
  onCellClick,
}: TimeColumnProps) {
  return (
    <div>
      {/* 날짜 헤더만 dim — 셀 자체는 항상 다른 사람 가용 색을 보여줘야 한다. */}
      <div
        className={cn(
          "text-center text-xs font-medium pb-1",
          disabled
            ? "text-gray-300 dark:text-gray-600 line-through"
            : "text-gray-500 dark:text-gray-400"
        )}
      >
        {formatDateShort(date)}
      </div>
      <div className="flex flex-col">
        {TIME_SLOTS.map((time) => (
          <TimeSlotCell
            key={time}
            date={date}
            time={time}
            disabled={disabled}
            selected={isSlotSelected(date, time)}
            isPendingStart={
              pendingStart?.date === date && pendingStart?.time === time
            }
            isPreview={previewSlots.has(`${date}T${time}`)}
            othersCount={othersHeatmap[time] ?? 0}
            othersTotal={othersTotal}
            onClick={() => onCellClick(date, time)}
          />
        ))}
      </div>
    </div>
  );
}
