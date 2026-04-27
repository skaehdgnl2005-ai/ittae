import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { mapTimeSlot } from "@/lib/mappers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: sessionId } = await params;
  const supabase = await createServerClient();

  // time_slots not yet in generated Supabase types — cast to any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("time_slots")
    .select("*")
    .eq("session_id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ data: ((data ?? []) as any[]).map(mapTimeSlot) });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id: sessionId } = await params;
  const body: { date: string; slots: { startTime: string; endTime: string }[] } =
    await request.json();

  const supabase = await createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Delete existing slots for this user+date
  const { error: deleteError } = await sb
    .from("time_slots")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .eq("date", body.date);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (body.slots.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Insert new slots
  const rows = body.slots.map((s) => ({
    session_id: sessionId,
    user_id: user.id,
    date: body.date,
    start_time: s.startTime,
    end_time: s.endTime,
  }));

  const { data, error: insertError } = await sb
    .from("time_slots")
    .insert(rows)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ data: ((data ?? []) as any[]).map(mapTimeSlot) });
}
