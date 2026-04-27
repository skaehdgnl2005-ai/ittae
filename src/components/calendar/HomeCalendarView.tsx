"use client";
import { useState } from "react";
import Link from "next/link";
import { MonthlyCalendar } from "@/components/calendar/MonthlyCalendar";
import { DayEventList } from "@/components/calendar/DayEventList";
import { TodaySummaryCard } from "@/components/calendar/TodaySummaryCard";
import { Button } from "@/components/ui/Button";
import { isSameDay } from "@/lib/date";
import type { Schedule, Group } from "@/types";

type HomeCalendarViewProps = {
  schedules: Schedule[];
  groups: Group[];
};

export function HomeCalendarView({ schedules, groups }: HomeCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const hasEventOnSelected = schedules.some((s) =>
    isSameDay(new Date(s.date), selectedDate)
  );

  return (
    <>
      <div className="pt-8 px-5 pb-4">
        <h2 className="text-[28px] font-bold text-gray-900 dark:text-gray-50 tracking-tight leading-tight">
          오늘의 모임
        </h2>
      </div>
      <TodaySummaryCard schedules={schedules} />
      <MonthlyCalendar
        schedules={schedules}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      <div className="mt-4" />
      <DayEventList date={selectedDate} schedules={schedules} groups={groups} />
      {!hasEventOnSelected && (
        <div className="px-5 mt-4">
          <Link href="/create">
            <Button variant="secondary">모임 만들기</Button>
          </Link>
        </div>
      )}
    </>
  );
}
