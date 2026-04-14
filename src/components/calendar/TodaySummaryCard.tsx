import { formatDateShort, isSameDay } from "@/lib/date";
import type { Schedule } from "@/types";

type TodaySummaryCardProps = {
  schedules: Schedule[];
};

export function TodaySummaryCard({ schedules }: TodaySummaryCardProps) {
  const today = new Date();
  const todaySchedules = schedules.filter((s) => isSameDay(new Date(s.date), today));
  const next = todaySchedules[0];

  return (
    <div className="mx-5 mt-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex">
      <div className="w-1 bg-violet-600 shrink-0" />
      <div className="p-4 flex-1">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">
          오늘 · {formatDateShort(today)}
        </p>
        {todaySchedules.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">오늘 일정이 없어요</p>
        ) : (
          <>
            <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
              일정 {todaySchedules.length}개
            </p>
            {next && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                다음: {next.title}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
