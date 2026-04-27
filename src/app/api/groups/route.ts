import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { mapGroup, mapUser } from "@/lib/mappers";
import type { Group, User } from "@/types";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const supabase = await createServerClient();
  const { data: myMemberships, error: memberError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const groupIds = (myMemberships ?? []).map((m) => m.group_id);

  if (groupIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: groupRows, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .in("id", groupIds)
    .order("created_at", { ascending: false });

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 500 });
  }

  // Batch fetch all memberships and users for these groups
  const { data: allMemberships } = await supabase
    .from("group_members")
    .select("group_id, user_id")
    .in("group_id", groupIds);

  const allUserIds = [...new Set((allMemberships ?? []).map((m) => m.user_id))];

  const { data: allUsers } = await supabase
    .from("users")
    .select("*")
    .in("id", allUserIds);

  const userMap = Object.fromEntries(
    (allUsers ?? []).map((u) => [u.id, mapUser(u)])
  );

  const membersByGroup = (allMemberships ?? []).reduce<Record<string, User[]>>(
    (acc, m) => {
      if (!acc[m.group_id]) acc[m.group_id] = [];
      const member = userMap[m.user_id];
      if (member) acc[m.group_id].push(member);
      return acc;
    },
    {}
  );

  const groups: Group[] = (groupRows ?? []).map((row) => ({
    ...mapGroup(row),
    members: membersByGroup[row.id] ?? [],
  }));

  return NextResponse.json({ data: groups });
}

export async function POST(request: NextRequest) {
  const body: { name: string; memberIds?: string[] } = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const supabase = await createServerClient();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({
      name: body.name.trim(),
      host_id: user.id,
      status: "voting",
    })
    .select()
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: groupError?.message ?? "Failed to create group" }, { status: 500 });
  }

  // Add host + requested members
  const memberIds = [...new Set([user.id, ...(body.memberIds ?? [])])];
  const { error: memberError } = await supabase
    .from("group_members")
    .insert(memberIds.map((uid) => ({ group_id: group.id, user_id: uid })));

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapGroup(group) }, { status: 201 });
}
