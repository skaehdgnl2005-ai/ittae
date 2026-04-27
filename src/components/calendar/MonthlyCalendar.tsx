"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, subMonths, formatMonthYear, getCalendarDays, isSameDay } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { Schedule } from "@/types";

type MonthlyCalendarProps = {
  schedules: Schedule[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function MonthlyCalendar({ schedules, selectedDate, onSelectDate }: MonthlyCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = new Date();
  const days = getCalendarDays(currentMonth);

  return (
    <div className="mx-5 mt-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <button
          aria-label="이전 달"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 active:scale-95 transition-all text-gray-500 dark:text-gray-400"
        >
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>
        <span className="text-base font-semibold text-gray-800 dark:text-gray-100">
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
            <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="h-px bg-gray-100 dark:bg-gray-700 mb-1" />

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDate);
            const hasEvent = schedules.some((s) => isSameDay(new Date(s.date), day));

            return (
              <button
                key={idx}
                onClick={() => onSelectDate(day)}
                aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일`}
                className="flex flex-col items-center py-1.5 min-h-11 justify-center"
              >
                <span
                  className={cn(
                    "font-serif w-8 h-8 flex items-center justify-center text-xl rounded-full transition-all",
                    (isSelected || isToday)
                      ? "bg-violet-600 text-white shadow-[0_2px_6px_rgba(124,58,237,0.3)]"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
                    isToday && "font-semibold"
                  )}
                >
                  {day.getDate()}
                </span>
                {hasEvent && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-violet-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
