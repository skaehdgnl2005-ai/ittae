import { createServerClient } from "@/lib/supabase/server";
import { HomeCalendarView } from "@/components/calendar/HomeCalendarView";
import type { Database } from "@/types/supabase";
import type { Schedule, Group } from "@/types";

type ScheduleRow = Database["public"]["Tables"]["schedules"]["Row"];
type GroupRow = Database["public"]["Tables"]["groups"]["Row"];

function mapSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    date: row.date,
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    memo: row.memo,
    type: "personal",
  };
}

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    hostId: row.host_id,
    status: row.status,
    confirmedDate: row.confirmed_date,
    placeId: row.place_id,
    createdAt: row.created_at,
    members: [],
  };
}

export default async function HomePage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = month.toString().padStart(2, "0");

  const supabase = await createServerClient();

  const [{ data: schedulesData }, { data: groupsData }] = await Promise.all([
    supabase
      .from("schedules")
      .select("*")
      .gte("date", `${year}-${monthStr}-01`)
      .lte("date", `${year}-${monthStr}-31`)
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
      <HomeCalendarView schedules={schedules} groups={groups} />
    </div>
  );
}
