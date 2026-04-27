"use client";

import { TIME_SLOTS } from "@/lib/vote";
import { TimeSlotCell } from "./TimeSlotCell";

type TimeColumnProps = {
  date: string;
  disabled: boolean;
  isSlotSelected: (date: string, time: string) => boolean;
  pendingStart: { date: string; time: string } | null;
  previewSlots: Set<string>;
  heatmap: Record<string, number>;
  totalMembers: number;
  showHeatmap: boolean;
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
  heatmap,
  totalMembers,
  showHeatmap,
  onCellClick,
}: TimeColumnProps) {
  return (
    <div className={disabled ? "opacity-35" : ""}>
      <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 pb-1">
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
            heatCount={heatmap[time] ?? 0}
            totalMembers={totalMembers}
            showHeatmap={showHeatmap}
            onClick={() => onCellClick(date, time)}
          />
        ))}
      </div>
    </div>
  );
}
