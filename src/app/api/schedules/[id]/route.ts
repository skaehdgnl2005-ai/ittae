import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { mapSchedule } from "@/lib/mappers";
import type { Database } from "@/types/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body: {
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    memo?: string;
  } = await request.json();

  const update: Database["public"]["Tables"]["schedules"]["Update"] = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.date !== undefined) update.date = body.date;
  if (body.startTime !== undefined) update.start_time = body.startTime;
  if (body.endTime !== undefined) update.end_time = body.endTime;
  if (body.memo !== undefined) update.memo = body.memo;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("schedules")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapSchedule(data) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const deleteAuth = await requireAuth();
  if (deleteAuth.error) return deleteAuth.error;

  const supabase = await createServerClient();
  const { error } = await supabase.from("schedules").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: null }, { status: 200 });
}
