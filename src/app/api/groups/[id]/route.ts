import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { mapGroup, mapUser } from "@/lib/mappers";
import type { GroupStatus, User } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const supabase = await createServerClient();

  // Verify user is a member of this group
  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { data: allMemberships } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", id);

  const memberIds = (allMemberships ?? []).map((m) => m.user_id);
  const { data: usersData } = await supabase
    .from("users")
    .select("*")
    .in("id", memberIds);

  const members: User[] = (usersData ?? []).map(mapUser);

  return NextResponse.json({
    data: { ...mapGroup(group), members },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body: {
    name?: string;
    status?: GroupStatus;
    confirmedDate?: string | null;
  } = await request.json();

  const patchAuth = await requireAuth();
  if (patchAuth.error) return patchAuth.error;
  const { user } = patchAuth;

  const supabase = await createServerClient();

  // Only host can update group
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

  const updates: {
    name?: string;
    status?: GroupStatus;
    confirmed_date?: string | null;
  } = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) updates.status = body.status;
  if (body.confirmedDate !== undefined) updates.confirmed_date = body.confirmedDate;

  const { data: updated, error } = await supabase
    .from("groups")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ data: mapGroup(updated) });
}
