import { createServerClient } from "@/lib/supabase/server";
import { HomeCalendarView } from "@/components/calendar/HomeCalendarView";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { mapSchedule, mapGroup } from "@/lib/mappers";
import type { Schedule, Group } from "@/types";

export default async function HomePage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = month.toString().padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${monthStr}-${lastDay.toString().padStart(2, "0")}`;

  const supabase = await createServerClient();

  const [{ data: schedulesData }, { data: groupsData }] = await Promise.all([
    supabase
      .from("schedules")
      .select("*")
      .gte("date", `${year}-${monthStr}-01`)
      .lte("date", toDate)
      .order("date", { ascending: true }),
    supabase
      .from("groups")
      .select("*")
      .in("status", ["confirmed", "voting"]),
  ]);

  const schedules: Schedule[] = (schedulesData ?? []).map(mapSchedule);
  const groups: Group[] = (groupsData ?? []).map(mapGroup);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-dvh">
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-gray-100">
          된다
        </h1>
        <LogoutButton />
      </div>
      <HomeCalendarView schedules={schedules} groups={groups} />
    </div>
  );
}
