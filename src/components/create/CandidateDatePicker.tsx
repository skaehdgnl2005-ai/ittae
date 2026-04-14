"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  subMonths,
  formatMonthYear,
  getCalendarDays,
} from "@/lib/date";
import {
  toggleCandidateDate,
  isPastDate,
  formatCandidateChip,
} from "@/lib/candidate-dates";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type CandidateDatePickerProps = {
  selected: string[];
  onChange: (dates: string[]) => void;
};

export function CandidateDatePicker({
  selected,
  onChange,
}: CandidateDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const days = getCalendarDays(currentMonth);

  const handleDayClick = (day: Date) => {
    if (isPastDate(day)) return;
    const dateStr = format(day, "yyyy-MM-dd");
    onChange(toggleCandidateDate(selected, dateStr));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* 월 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <button
          aria-label="이전 달"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 active:scale-95 transition-all text-gray-500 dark:text-gray-400"
        >
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {formatMonthYear(currentMonth)}
        </span>
        <button
          aria-label="다음 달"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 active:scale-95 transition-all text-gray-500 dark:text-gray-400"
        >
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      </div>

      <div className="px-4 pb-4">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mt-3">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1.5"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="h-px bg-gray-100 dark:bg-gray-700 mb-1" />

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateStr = format(day, "yyyy-MM-dd");
            const isSelected = selected.includes(dateStr);
            const isPast = isPastDate(day);

            return (
              <button
                key={idx}
                onClick={() => handleDayClick(day)}
                disabled={isPast}
                aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일${isSelected ? " 선택됨" : ""}`}
                aria-pressed={isSelected}
                className={cn(
                  "flex flex-col items-center py-1.5 min-h-11 justify-center",
                  isPast && "opacity-30 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "font-serif w-8 h-8 flex items-center justify-center text-sm rounded-full transition-all",
                    isSelected
                      ? "bg-violet-600 text-white shadow-[0_2px_6px_rgba(124,58,237,0.3)]"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* 선택 날짜 칩 요약 */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            {selected.map((d) => (
              <button
                key={d}
                onClick={() => onChange(toggleCandidateDate(selected, d))}
                aria-label={`${formatCandidateChip(d)} 선택 해제`}
                className="flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 text-xs rounded-full px-3 py-1 font-medium"
              >
                {formatCandidateChip(d)}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
