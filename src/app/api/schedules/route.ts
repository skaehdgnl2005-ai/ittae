import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { mapSchedule } from "@/lib/mappers";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10);

  const monthStr = month.toString().padStart(2, "0");
  const fromDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${monthStr}-${lastDay.toString().padStart(2, "0")}`;

  const supabase = await createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .gte("date", fromDate)
    .lte("date", toDate)
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
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("schedules")
    .insert({
      user_id: user.id,
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
