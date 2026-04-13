"use client";
import { formatDateShort, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { AvatarGroup } from "@/components/ui/Avatar";
import type { Schedule, Group } from "@/types";

type DayEventListProps = {
  date: Date;
  schedules: Schedule[];
  groups: Group[];
};

export function DayEventList({ date, schedules, groups }: DayEventListProps) {
  const daySchedules = schedules.filter((s) => {
    const sd = new Date(s.date);
    return sd.toDateString() === date.toDateString();
  });

  if (daySchedules.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">이 날은 일정이 없어요</p>
      </div>
    );
  }

  return (
    <div className="px-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-4 mb-2">
        {formatDateShort(date)} 일정
      </h3>
      {daySchedules.map((schedule) => {
        const isGroup = schedule.type === "group";
        // TODO: Schedule에 groupId가 없어 confirmedDate로 매칭 중 (MVP 한계).
        // 추후 Schedule 타입에 groupId 추가 후 정확한 매칭으로 개선 필요.
        const relatedGroup = isGroup
          ? groups.find((g) => g.confirmedDate === schedule.date) ?? null
          : null;

        return (
          <div
            key={schedule.id}
            className={cn(
              "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex gap-3",
              "shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            )}
          >
            {/* 컬러 바 */}
            <div
              className={cn(
                "w-[3px] rounded-full shrink-0",
                isGroup ? "bg-violet-600" : "bg-gray-300 dark:bg-gray-600"
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {schedule.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatTime(schedule.startTime)} — {formatTime(schedule.endTime)}
              </p>
              {relatedGroup && (
                <div className="mt-2">
                  <AvatarGroup users={relatedGroup.members} max={4} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
