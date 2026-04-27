import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReauthRequiredError, refreshAccessToken } from "./oauth";
import { listPrimaryEvents, type GoogleEvent } from "./calendar-api";
import type { Database } from "@/types/supabase";

type SchedulesInsert = Database["public"]["Tables"]["schedules"]["Insert"];

export type SyncResult =
  | { ok: true; data: { added: number; updated: number; removed: number } }
  | { ok: false; error: "NOT_CONNECTED" | "REAUTH_REQUIRED" | "UNKNOWN" };

const KST_OFFSET_MIN = 9 * 60;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toKstDateAndTime(iso: string): { date: string; time: string } {
  const utc = new Date(iso);
  const kstMs = utc.getTime() + KST_OFFSET_MIN * 60 * 1000;
  const kst = new Date(kstMs);
  const yyyy = kst.getUTCFullYear();
  const mm = pad2(kst.getUTCMonth() + 1);
  const dd = pad2(kst.getUTCDate());
  const hh = pad2(kst.getUTCHours());
  const mi = pad2(kst.getUTCMinutes());
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

function todayKstDateString(now: Date): string {
  const kstMs = now.getTime() + KST_OFFSET_MIN * 60 * 1000;
  const kst = new Date(kstMs);
  return `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(
    kst.getUTCDate()
  )}`;
}

export function googleEventToScheduleInsert(
  event: GoogleEvent,
  userId: string
): SchedulesInsert {
  const isAllDay = !!event.start.date;
  const title =
    event.visibility === "private"
      ? "(비공개 일정)"
      : event.summary?.trim() || "제목 없음";

  if (isAllDay) {
    return {
      user_id: userId,
      title,
      date: event.start.date!,
      start_time: "00:00",
      end_time: "23:59",
      memo: null,
      source: "google",
      external_event_id: event.id,
      external_etag: event.etag ?? null,
    };
  }

  const startKst = toKstDateAndTime(event.start.dateTime!);
  const endKst = toKstDateAndTime(event.end.dateTime!);

  return {
    user_id: userId,
    title,
    date: startKst.date,
    start_time: startKst.time,
    end_time: endKst.time,
    memo: null,
    source: "google",
    external_event_id: event.id,
    external_etag: event.etag ?? null,
  };
}

export async function syncUserGoogleCalendar(
  userId: string
): Promise<SyncResult> {
  const admin = createAdminClient();

  const { data: user, error: userErr } = await admin
    .from("users")
    .select("google_refresh_token")
    .eq("id", userId)
    .single();

  if (userErr || !user?.google_refresh_token) {
    return { ok: false, error: "NOT_CONNECTED" };
  }

  let accessToken: string;
  try {
    const tokens = await refreshAccessToken(user.google_refresh_token);
    accessToken = tokens.access_token;
  } catch (e) {
    if (e instanceof ReauthRequiredError) {
      await admin
        .from("users")
        .update({ google_refresh_token: null })
        .eq("id", userId);
      return { ok: false, error: "REAUTH_REQUIRED" };
    }
    return { ok: false, error: "UNKNOWN" };
  }

  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let events: GoogleEvent[];
  try {
    events = await listPrimaryEvents(accessToken, now, in30d);
  } catch (e) {
    if (e instanceof ReauthRequiredError) {
      await admin
        .from("users")
        .update({ google_refresh_token: null })
        .eq("id", userId);
      return { ok: false, error: "REAUTH_REQUIRED" };
    }
    return { ok: false, error: "UNKNOWN" };
  }

  const incoming = events.map((e) => googleEventToScheduleInsert(e, userId));

  const fromDate = todayKstDateString(now);
  const toDate = todayKstDateString(in30d);

  const { data: existing } = await admin
    .from("schedules")
    .select("id, external_event_id, title, date, start_time, end_time")
    .eq("user_id", userId)
    .eq("source", "google")
    .gte("date", fromDate)
    .lte("date", toDate);

  const existingMap = new Map(
    (existing ?? [])
      .filter((s) => s.external_event_id)
      .map((s) => [s.external_event_id!, s])
  );
  const incomingIds = new Set(
    incoming.map((i) => i.external_event_id!).filter(Boolean)
  );

  const toInsert = incoming.filter(
    (i) => !existingMap.has(i.external_event_id!)
  );

  const toUpdate = incoming.filter((i) => {
    const ex = existingMap.get(i.external_event_id!);
    if (!ex) return false;
    return (
      ex.title !== i.title ||
      ex.date !== i.date ||
      ex.start_time !== i.start_time ||
      ex.end_time !== i.end_time
    );
  });

  const toDeleteIds = (existing ?? [])
    .filter(
      (s) => s.external_event_id && !incomingIds.has(s.external_event_id)
    )
    .map((s) => s.id);

  if (toInsert.length > 0) {
    const { error } = await admin.from("schedules").insert(toInsert);
    if (error) return { ok: false, error: "UNKNOWN" };
  }

  for (const u of toUpdate) {
    await admin
      .from("schedules")
      .update({
        title: u.title,
        date: u.date,
        start_time: u.start_time,
        end_time: u.end_time,
        external_etag: u.external_etag,
      })
      .eq("user_id", userId)
      .eq("external_event_id", u.external_event_id!);
  }

  if (toDeleteIds.length > 0) {
    await admin.from("schedules").delete().in("id", toDeleteIds);
  }

  await admin
    .from("users")
    .update({ google_calendar_synced_at: new Date().toISOString() })
    .eq("id", userId);

  revalidatePath("/home");

  return {
    ok: true,
    data: {
      added: toInsert.length,
      updated: toUpdate.length,
      removed: toDeleteIds.length,
    },
  };
}
