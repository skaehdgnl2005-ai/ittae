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
    <div className="px-5 pt-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <button
          aria-label="이전 달"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 -ml-2 text-gray-500 active:text-gray-800"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="text-lg font-semibold text-gray-800">
          {formatMonthYear(currentMonth)}
        </span>
        <button
          aria-label="다음 달"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 -mr-2 text-gray-500 active:text-gray-800"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

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
              className="flex flex-col items-center py-1 min-h-11 justify-center"
            >
              <span
                className={cn(
                  "font-serif w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors",
                  isSelected && "bg-violet-600 text-white",
                  isToday && !isSelected && "bg-violet-100 text-violet-700 font-semibold",
                  !isToday && !isSelected && "text-gray-700"
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
  );
}
