"use client";
import { useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { formatDateShort, formatTime, isSameDay } from "@/lib/date";
import { cn } from "@/lib/utils";
import { AvatarGroup } from "@/components/ui/Avatar";
import { findConflictingGroupIds } from "@/lib/schedule-conflict";
import type { Schedule, Group } from "@/types";

type DayEventListProps = {
  date: Date;
  schedules: Schedule[];
  groups: Group[];
  onSelectSchedule?: (schedule: Schedule) => void;
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

const LONG_PRESS_MS = 300;

function GoogleSourceBadge() {
  return (
    <span
      aria-label="Google 캘린더 일정"
      className="inline-flex items-center justify-center ml-1 align-middle text-gray-400 dark:text-gray-500"
      title="Google 캘린더에서 가져온 일정"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21.6 12.227c0-.692-.062-1.385-.184-2.046H12v3.873h5.385a4.61 4.61 0 0 1-2 3.027v2.508h3.231c1.892-1.738 2.984-4.308 2.984-7.362z" />
        <path d="M12 22c2.7 0 4.969-.892 6.616-2.41l-3.231-2.509c-.892.6-2.046.954-3.385.954-2.6 0-4.808-1.754-5.6-4.115H3.062v2.585A10 10 0 0 0 12 22z" />
        <path d="M6.4 13.92a6 6 0 0 1 0-3.838V7.497H3.062a10 10 0 0 0 0 9.006z" />
        <path d="M12 5.967c1.466 0 2.785.504 3.823 1.495l2.866-2.866C16.967 2.962 14.7 2 12 2A10 10 0 0 0 3.062 7.497L6.4 10.082C7.192 7.72 9.4 5.967 12 5.967z" />
      </svg>
    </span>
  );
}

export function DayEventList({ date, schedules, groups, onSelectSchedule }: DayEventListProps) {
  const daySchedules = schedules.filter((s) => isSameDay(new Date(s.date), date));
  const conflictingGroupIds = findConflictingGroupIds(daySchedules);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (daySchedules.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">이 날은 일정이 없어요</p>
      </div>
    );
  }

  function startLongPress(schedule: Schedule) {
    if (!onSelectSchedule) return;
    if (schedule.type !== "personal" || schedule.source !== "manual") return;
    longPressTimer.current = setTimeout(() => {
      onSelectSchedule(schedule);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
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
          const isConflict = isGroup && conflictingGroupIds.has(schedule.id);
          const isManualPersonal =
            schedule.type === "personal" && schedule.source === "manual";
          const relatedGroup = isGroup
            ? groups.find((g) => g.confirmedDate === schedule.date) ?? null
            : null;

          return (
            <motion.div
              key={schedule.id}
              variants={itemVariants}
              onPointerDown={() => isManualPersonal && startLongPress(schedule)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              className={cn(
                "border rounded-xl p-4 flex gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
                isConflict
                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
                  : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700",
                isManualPersonal && "select-none"
              )}
            >
              {/* 컬러 바 */}
              <div
                className={cn(
                  "w-[3px] rounded-full shrink-0",
                  isConflict
                    ? "bg-amber-500"
                    : isGroup
                      ? "bg-violet-600"
                      : "bg-gray-300 dark:bg-gray-600"
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate flex items-center">
                  <span className="truncate">{schedule.title}</span>
                  {schedule.source === "google" && <GoogleSourceBadge />}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatTime(schedule.startTime)} — {formatTime(schedule.endTime)}
                </p>
                {relatedGroup && (
                  <div className="mt-2">
                    <AvatarGroup users={relatedGroup.members} max={4} />
                  </div>
                )}
                {isConflict && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                    ⚠ 내 일정과 겹쳐요
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
