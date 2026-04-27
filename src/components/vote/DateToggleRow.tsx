"use client";

import { cn } from "@/lib/utils";
import type { VoteChoice } from "@/types";

type DateToggleRowProps = {
  dates: string[];
  choices: Record<string, VoteChoice | null>;
  onToggle: (date: string) => void;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[d.getDay()];
  return `${month}/${day}(${weekday})`;
}

export function DateToggleRow({ dates, choices, onToggle }: DateToggleRowProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {dates.map((date) => {
        const choice = choices[date] ?? null;
        return (
          <button
            key={date}
            onClick={() => onToggle(date)}
            aria-label={`${formatDate(date)} ${choice === "available" ? "가능" : choice === "unavailable" ? "불가" : "미선택"}`}
            className={cn(
              "flex-shrink-0 min-h-11 min-w-11 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              "border",
              choice === "available" &&
                "bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300",
              choice === "unavailable" &&
                "bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-500",
              choice === null &&
                "bg-white border-dashed border-gray-300 text-gray-500 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-400"
            )}
          >
            <span className="block text-xs">
              {choice === "available" ? "O" : choice === "unavailable" ? "X" : "—"}
            </span>
            <span className="block">{formatDate(date)}</span>
          </button>
        );
      })}
    </div>
  );
}
