import { createServerClient } from "@/lib/supabase/server";
import { HomeCalendarView } from "@/components/calendar/HomeCalendarView";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { LoginButton } from "@/components/layout/LoginButton";
import { SettingsLink } from "@/components/layout/SettingsLink";
import { AddPersonalScheduleButton } from "@/components/calendar/AddPersonalScheduleButton";
import { GoogleSyncIndicator } from "@/components/calendar/GoogleSyncIndicator";
import { ReauthBanner } from "@/components/calendar/ReauthBanner";
import { EverytimeImportButton } from "@/components/calendar/EverytimeImportButton";
import { GoogleConnectButton } from "@/components/calendar/GoogleConnectButton";
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

function buildGoogleStatusMessage(google: string | undefined) {
  switch (google) {
    case "connected":
      return { kind: "success" as const, text: "구글 캘린더가 연결되었어요." };
    case "invalid":
      return { kind: "error" as const, text: "보안 검증에 실패했어요. 다시 시도해 주세요." };
    case "error":
      return { kind: "error" as const, text: "토큰 교환에 실패했어요." };
    case "norefresh":
      return {
        kind: "error" as const,
        text: "구글 보안 설정에서 우리 앱 접근 권한을 한 번 제거한 뒤 다시 연결해 주세요.",
      };
    case "db_error":
      return { kind: "error" as const, text: "저장에 실패했어요. 다시 시도해 주세요." };
    default:
      return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const params = await searchParams;
  const googleStatus = buildGoogleStatusMessage(params.google);
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
    authUser
      ? supabase
          .from("schedules")
          .select("*")
          .eq("user_id", authUser.id)
          .gte("date", `${year}-${monthStr}-01`)
          .lte("date", toDate)
          .order("date", { ascending: true })
      : Promise.resolve({ data: [] }),
    authUser
      ? supabase
          .from("groups")
          .select("*")
          .in("status", ["confirmed", "voting"])
      : Promise.resolve({ data: [] }),
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
  const everytimeCount = schedules.filter((s) => s.source === "everytime").length;
  const hasEverytime = everytimeCount > 0;

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
          <AddPersonalScheduleButton isAuthed={!!authUser} />
          <SettingsLink isAuthed={!!authUser} />
          {authUser ? <LogoutButton /> : <LoginButton />}
        </div>
      </div>
      {authUser && (
        <>
          <ReauthBanner needsReauth={needsReauth} />
          {googleStatus && (
            <p
              className={
                googleStatus.kind === "success"
                  ? "px-5 pt-2 text-xs text-violet-700 dark:text-violet-300"
                  : "px-5 pt-2 text-xs text-red-600 dark:text-red-400"
              }
            >
              {googleStatus.text}
            </p>
          )}
          {syncedAt && (
            <div className="px-5 pt-1">
              <GoogleSyncIndicator syncedAt={syncedAt} />
            </div>
          )}
          <div className="px-5 pt-2 grid grid-cols-2 gap-2">
            <EverytimeImportButton
              hasExistingEverytime={hasEverytime}
              existingCount={everytimeCount}
            />
            <GoogleConnectButton
              connectedEmail={userInfo?.google_calendar_email ?? null}
            />
          </div>
        </>
      )}
      <HomeCalendarView
        schedules={allSchedules}
        groups={groups}
        isAuthed={!!authUser}
      />
    </div>
  );
}
