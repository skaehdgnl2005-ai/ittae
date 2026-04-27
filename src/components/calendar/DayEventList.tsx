"use client";
import { motion, type Variants } from "framer-motion";
import { formatDateShort, formatTime, isSameDay } from "@/lib/date";
import { cn } from "@/lib/utils";
import { AvatarGroup } from "@/components/ui/Avatar";
import type { Schedule, Group } from "@/types";

type DayEventListProps = {
  date: Date;
  schedules: Schedule[];
  groups: Group[];
};

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export function DayEventList({ date, schedules, groups }: DayEventListProps) {
  const daySchedules = schedules.filter((s) => isSameDay(new Date(s.date), date));

  if (daySchedules.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">이 날은 일정이 없어요</p>
      </div>
    );
  }

  return (
    <div className="px-5 space-y-3 pb-8">
      <div className="flex items-center gap-2 mt-4 mb-1">
        <div className="w-0.5 h-4 bg-violet-600 rounded-full shrink-0" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {formatDateShort(date)} 일정
        </h3>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
        {daySchedules.map((schedule) => {
          const isGroup = schedule.type === "group";
          // TODO: Schedule에 groupId가 없어 confirmedDate로 매칭 중 (MVP 한계).
          // 추후 Schedule 타입에 groupId 추가 후 정확한 매칭으로 개선 필요.
          const relatedGroup = isGroup
            ? groups.find((g) => g.confirmedDate === schedule.date) ?? null
            : null;

          return (
            <motion.div
              key={schedule.id}
              variants={itemVariants}
              className={cn(
                "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex gap-3",
                "shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
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
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
