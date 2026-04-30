import { createServerClient } from "@/lib/supabase/server";
import { HomeCalendarView } from "@/components/calendar/HomeCalendarView";
import Link from "next/link";
import { Settings } from "lucide-react";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { AddPersonalScheduleButton } from "@/components/calendar/AddPersonalScheduleButton";
import { GoogleSyncIndicator } from "@/components/calendar/GoogleSyncIndicator";
import { ReauthBanner } from "@/components/calendar/ReauthBanner";
import { mapSchedule, mapGroup } from "@/lib/mappers";
import { syncUserGoogleCalendar } from "@/lib/google/sync";
import type { Schedule, Group } from "@/types";

const STALE_THRESHOLD_MS = 60 * 60 * 1000;

function buildGroupSchedule(group: Group): Schedule | null {
  if (!group.confirmedDate) return null;
  return {
    id: `group-schedule-${group.id}`,
    userId: group.hostId,
    title: group.name,
    date: group.confirmedDate,
    startTime: "",
    endTime: "",
    memo: null,
    type: "group",
    source: "manual",
    externalEventId: null,
  };
}

export default async function HomePage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = month.toString().padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${monthStr}-${lastDay.toString().padStart(2, "0")}`;

  const supabase = await createServerClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const [
    { data: schedulesData },
    { data: groupsData },
    userInfoRes,
  ] = await Promise.all([
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
    authUser
      ? supabase
          .from("users")
          .select(
            "google_refresh_token, google_calendar_email, google_calendar_synced_at"
          )
          .eq("id", authUser.id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const userInfo = userInfoRes.data;
  const hasToken = !!userInfo?.google_refresh_token;
  const hasEmail = !!userInfo?.google_calendar_email;
  const syncedAt = userInfo?.google_calendar_synced_at ?? null;
  const needsReauth = !hasToken && hasEmail;

  // Stale 체크 + fire-and-forget sync. 페이지 렌더 블록하지 않음.
  if (authUser && hasToken) {
    const isStale =
      !syncedAt ||
      now.getTime() - new Date(syncedAt).getTime() > STALE_THRESHOLD_MS;
    if (isStale) {
      void syncUserGoogleCalendar(authUser.id).catch(() => {});
    }
  }

  const schedules: Schedule[] = (schedulesData ?? []).map(mapSchedule);
  const groups: Group[] = (groupsData ?? []).map(mapGroup);

  // 확정된 그룹 모임을 schedule 형태로 합성 → DayEventList가 그룹 카드를 렌더할 수 있게 함
  const groupSchedules = groups
    .map(buildGroupSchedule)
    .filter((s): s is Schedule => s !== null);
  const allSchedules = [...schedules, ...groupSchedules];

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-dvh">
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-gray-100">
          된다
        </h1>
        <div className="flex items-center gap-1">
          <AddPersonalScheduleButton />
          <Link
            href="/profile"
            aria-label="프로필 / 설정"
            className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all min-h-11 min-w-11 text-gray-600 dark:text-gray-400"
          >
            <Settings size={18} strokeWidth={1.8} />
          </Link>
          <LogoutButton />
        </div>
      </div>
      <ReauthBanner needsReauth={needsReauth} />
      {syncedAt && (
        <div className="px-5 pt-1">
          <GoogleSyncIndicator syncedAt={syncedAt} />
        </div>
      )}
      <HomeCalendarView schedules={allSchedules} groups={groups} />
    </div>
  );
}
