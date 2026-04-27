"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type PersonalScheduleInput = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  memo: string | null;
  isAllDay: boolean;
};

function validate(input: PersonalScheduleInput): string | null {
  if (!input.title.trim()) return "제목을 입력해 주세요";
  if (input.title.length > 80) return "제목은 80자 이내로 작성해 주세요";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "날짜 형식이 올바르지 않아요";
  if (!input.isAllDay) {
    if (!/^\d{2}:\d{2}$/.test(input.startTime)) return "시작 시간이 올바르지 않아요";
    if (!/^\d{2}:\d{2}$/.test(input.endTime)) return "종료 시간이 올바르지 않아요";
    if (input.startTime >= input.endTime) {
      return "종료 시간은 시작 시간보다 늦어야 해요";
    }
  }
  if (input.memo && input.memo.length > 200) {
    return "메모는 200자 이내로 작성해 주세요";
  }
  return null;
}

function normalizeTimes(input: PersonalScheduleInput) {
  if (input.isAllDay) {
    return { start_time: "00:00", end_time: "23:59" };
  }
  return { start_time: input.startTime, end_time: input.endTime };
}

export async function createPersonalSchedule(
  input: PersonalScheduleInput
): Promise<Result<{ id: string }>> {
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요" };

  const times = normalizeTimes(input);
  const { data, error } = await supabase
    .from("schedules")
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      date: input.date,
      start_time: times.start_time,
      end_time: times.end_time,
      memo: input.memo?.trim() || null,
      source: "manual",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "저장에 실패했어요" };
  revalidatePath("/home");
  return { ok: true, data: { id: data.id } };
}

export async function updatePersonalSchedule(
  id: string,
  input: PersonalScheduleInput
): Promise<Result<void>> {
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요" };

  const { data: existing, error: fetchErr } = await supabase
    .from("schedules")
    .select("source")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !existing) return { ok: false, error: "일정을 찾을 수 없어요" };
  if (existing.source === "google") {
    return { ok: false, error: "Google 캘린더 일정은 우리 앱에서 수정할 수 없어요" };
  }

  const times = normalizeTimes(input);
  const { error } = await supabase
    .from("schedules")
    .update({
      title: input.title.trim(),
      date: input.date,
      start_time: times.start_time,
      end_time: times.end_time,
      memo: input.memo?.trim() || null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true, data: undefined };
}

export async function deletePersonalSchedule(
  id: string
): Promise<Result<void>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요" };

  const { data: existing, error: fetchErr } = await supabase
    .from("schedules")
    .select("source")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !existing) return { ok: false, error: "일정을 찾을 수 없어요" };
  if (existing.source === "google") {
    return { ok: false, error: "Google 캘린더 일정은 우리 앱에서 삭제할 수 없어요" };
  }

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true, data: undefined };
}
