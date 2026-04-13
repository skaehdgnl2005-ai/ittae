"use client";
import { useState } from "react";
import { MonthlyCalendar } from "@/components/calendar/MonthlyCalendar";
import { DayEventList } from "@/components/calendar/DayEventList";
import { TodaySummaryCard } from "@/components/calendar/TodaySummaryCard";
import { Button } from "@/components/ui/Button";
import { mockSchedules, mockGroups } from "@/lib/mock";

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const hasEventOnSelected = mockSchedules.some(
    (s) => s.date === selectedDate.toISOString().slice(0, 10)
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-dvh">
      <TodaySummaryCard schedules={mockSchedules} />
      <MonthlyCalendar
        schedules={mockSchedules}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      <div className="h-px bg-gray-200 dark:bg-gray-700 mx-5 my-3" />
      <DayEventList date={selectedDate} schedules={mockSchedules} groups={mockGroups} />
      {!hasEventOnSelected && (
        <div className="px-5 mt-4">
          <Button variant="secondary">모임 만들기</Button>
        </div>
      )}
    </div>
  );
}
