import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGuest } from "@/lib/supabase/guestAuth";
import { mapTimeSlot } from "@/lib/mappers";

type Params = { params: Promise<{ code: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const auth = await requireGuest(request, code);
  if ("error" in auth && auth.error) return auth.error;
  const { guestId, groupId } = auth as { guestId: string; groupId: string };

  const admin = createAdminClient();

  const { data: g } = await admin
    .from("groups")
    .select("status")
    .eq("id", groupId)
    .maybeSingle();
  if (g?.status !== "voting") {
    return NextResponse.json({ error: "모임이 마감되었어요" }, { status: 409 });
  }

  const body: { date: string; slots: { startTime: string; endTime: string }[] } =
    await request.json();

  const { data: session } = await admin
    .from("vote_sessions")
    .select("id")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "No vote session" }, { status: 404 });
  }
  const sessionId = session.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { error: delErr } = await sb
    .from("time_slots")
    .delete()
    .eq("session_id", sessionId)
    .eq("guest_id", guestId)
    .eq("date", body.date);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (body.slots.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const rows = body.slots.map((s) => ({
    session_id: sessionId,
    user_id: null,
    guest_id: guestId,
    date: body.date,
    start_time: s.startTime,
    end_time: s.endTime,
  }));

  const { data, error: insErr } = await sb.from("time_slots").insert(rows).select();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ data: ((data ?? []) as any[]).map(mapTimeSlot) });
}
