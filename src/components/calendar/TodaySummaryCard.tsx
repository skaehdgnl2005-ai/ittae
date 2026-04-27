import { formatDateShort, isSameDay } from "@/lib/date";
import type { Schedule } from "@/types";

type TodaySummaryCardProps = {
  schedules: Schedule[];
};

export function TodaySummaryCard({ schedules }: TodaySummaryCardProps) {
  const today = new Date();
  const todaySchedules = schedules.filter((s) => isSameDay(new Date(s.date), today));
  const next = todaySchedules[0];

  if (todaySchedules.length === 0) {
    return null;
  }

  return (
    <div className="mx-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex">
      <div className="w-1 bg-violet-600 shrink-0" />
      <div className="p-4 flex-1">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">
          오늘 · {formatDateShort(today)}
        </p>
        <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
          일정 {todaySchedules.length}개
        </p>
        {next && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5 truncate">
            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">다음</span>
            <span className="font-serif text-[18px] text-violet-600 dark:text-violet-400 -mb-0.5">{next.startTime}</span>
            <span className="truncate">{next.title}</span>
          </p>
        )}
      </div>
    </div>
  );
}
