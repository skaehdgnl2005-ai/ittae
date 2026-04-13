import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { mapGroup } from "@/lib/mappers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: { confirmedDate: string } = await request.json();

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { data: updated, error } = await supabase
    .from("groups")
    .update({
      status: "confirmed",
      confirmed_date: body.confirmedDate,
    })
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
