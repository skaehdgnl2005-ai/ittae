import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { mapGroup } from "@/lib/mappers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const body: {
    confirmedDate: string;
    confirmedStartTime?: string;
    confirmedEndTime?: string;
  } = await request.json();
  const supabase = await createServerClient();

  // Only host can confirm
  const { data: group, error: fetchError } = await supabase
    .from("groups")
    .select("host_id")
    .eq("id", id)
    .single();

  if (fetchError || !group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (group.host_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // confirmed_start_time, confirmed_end_time are added by migration 002 but not yet in generated types
  const updatePayload = {
    status: "confirmed" as const,
    confirmed_date: body.confirmedDate,
    ...(body.confirmedStartTime && { confirmed_start_time: body.confirmedStartTime }),
    ...(body.confirmedEndTime && { confirmed_end_time: body.confirmedEndTime }),
  };

  const { data: updated, error } = await supabase
    .from("groups")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq("id", id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: mapGroup(updated) });
}
