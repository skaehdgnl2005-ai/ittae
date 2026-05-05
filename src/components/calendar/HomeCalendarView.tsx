"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MonthlyCalendar } from "@/components/calendar/MonthlyCalendar";
import { DayEventList } from "@/components/calendar/DayEventList";
import { TodaySummaryCard } from "@/components/calendar/TodaySummaryCard";
import { AddPersonalScheduleSheet } from "@/components/calendar/AddPersonalScheduleSheet";
import { PersonalScheduleActionSheet } from "@/components/calendar/PersonalScheduleActionSheet";
import { Button } from "@/components/ui/Button";
import { isSameDay } from "@/lib/date";
import { deletePersonalSchedule } from "@/app/(main)/home/schedule-actions";
import type { Schedule, Group } from "@/types";

type HomeCalendarViewProps = {
  schedules: Schedule[];
  groups: Group[];
};

export function HomeCalendarView({ schedules, groups }: HomeCalendarViewProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [actionSchedule, setActionSchedule] = useState<Schedule | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [, startTransition] = useTransition();

  const hasEventOnSelected = schedules.some((s) =>
    isSameDay(new Date(s.date), selectedDate)
  );

  function handleEdit(schedule: Schedule) {
    setActionSchedule(null);
    setEditingSchedule(schedule);
    setAddSheetOpen(true);
  }

  function handleDelete(schedule: Schedule) {
    if (!confirm("이 일정을 삭제할까요?")) return;
    startTransition(async () => {
      const result = await deletePersonalSchedule(schedule.id);
      setActionSchedule(null);
      if (result.ok) {
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  function handleCloseAddSheet() {
    setAddSheetOpen(false);
    setEditingSchedule(null);
  }

  return (
    <>
      <div className="pt-8 px-5 pb-4">
        <h2 className="text-[28px] font-bold text-gray-900 dark:text-gray-50 tracking-tight leading-tight">
          내 일정
        </h2>
      </div>
      <TodaySummaryCard schedules={schedules} />
      <MonthlyCalendar
        schedules={schedules}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      <div className="mt-4" />
      <DayEventList
        date={selectedDate}
        schedules={schedules}
        groups={groups}
        onSelectSchedule={(s) => setActionSchedule(s)}
      />
      {!hasEventOnSelected && (
        <div className="px-5 mt-4 flex flex-col gap-2">
          <Link href="/create">
            <Button variant="secondary">모임 만들기</Button>
          </Link>
          <Button
            variant="ghost"
            onClick={() => {
              setEditingSchedule(null);
              setAddSheetOpen(true);
            }}
          >
            내 일정 추가
          </Button>
        </div>
      )}

      <AddPersonalScheduleSheet
        open={addSheetOpen}
        onClose={handleCloseAddSheet}
        defaultDate={selectedDate}
        editingSchedule={editingSchedule}
      />
      <PersonalScheduleActionSheet
        open={!!actionSchedule}
        schedule={actionSchedule}
        onClose={() => setActionSchedule(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </>
  );
}
