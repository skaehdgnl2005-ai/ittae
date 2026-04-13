import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { Schedule } from "@/types";

type ScheduleRow = Database["public"]["Tables"]["schedules"]["Row"];

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10);

  const monthStr = month.toString().padStart(2, "0");
  const from = `${year}-${monthStr}-01`;
  const to = `${year}-${monthStr}-31`;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const schedules = (data ?? []).map(mapSchedule);
  return NextResponse.json({ data: schedules });
}

export async function POST(request: NextRequest) {
  const body: {
    title: string;
    date: string;
    startTime?: string;
    endTime?: string;
    memo?: string;
  } = await request.json();

  if (!body.title || !body.date) {
    return NextResponse.json({ error: "title and date are required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("schedules")
    .insert({
      user_id: userData.user.id,
      title: body.title,
      date: body.date,
      start_time: body.startTime ?? null,
      end_time: body.endTime ?? null,
      memo: body.memo ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapSchedule(data) }, { status: 201 });
}
