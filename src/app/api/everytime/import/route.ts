import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { expandClasses } from "@/lib/everytime/expand";
import { DAYS_OF_WEEK, type ParsedClass } from "@/lib/everytime/types";

const MAX_CLASSES = 30;
const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ImportRequest = {
  classes: ParsedClass[];
  semesterStart: string;
  semesterEnd: string;
};

function validate(body: ImportRequest): string | null {
  if (!Array.isArray(body.classes) || body.classes.length === 0) {
    return "classes가 비어있어요";
  }
  if (body.classes.length > MAX_CLASSES) {
    return "한 번에 30개 이하만 추가할 수 있어요";
  }
  if (!DATE_RE.test(body.semesterStart) || !DATE_RE.test(body.semesterEnd)) {
    return "학기 날짜 형식이 올바르지 않아요";
  }
  if (body.semesterStart > body.semesterEnd) {
    return "학기 종료일이 시작일보다 빨라요";
  }
  for (const c of body.classes) {
    if (!c.title || c.title.trim().length === 0) return "과목명이 비어있어요";
    if (!DAYS_OF_WEEK.includes(c.dayOfWeek)) return "요일 형식이 올바르지 않아요";
    if (!TIME_RE.test(c.startTime) || !TIME_RE.test(c.endTime)) {
      return "시간 형식이 올바르지 않아요";
    }
    if (c.startTime >= c.endTime) return "종료 시간은 시작 시간보다 늦어야 해요";
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: ImportRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    const status = body.classes?.length > MAX_CLASSES ? 422 : 400;
    return NextResponse.json({ error: validationError }, { status });
  }

  const rows = expandClasses({
    classes: body.classes,
    semesterStart: body.semesterStart,
    semesterEnd: body.semesterEnd,
  });

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("replace_everytime_schedules", {
    p_user_id: user.id,
    p_payloads: rows,
  });

  if (error) {
    console.error("[/api/everytime/import] RPC failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      insertedCount: data ?? 0,
      classCount: body.classes.length,
    },
  });
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("schedules")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .eq("source", "everytime");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { deletedCount: count ?? 0 } });
}
