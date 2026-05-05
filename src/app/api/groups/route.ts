import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/auth";
import { mapGroup, mapUser } from "@/lib/mappers";
import { generateInviteCode } from "@/lib/inviteCode";
import type { Group, User } from "@/types";
import type { Database } from "@/types/supabase";

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

  // invite_code 자동 발급 (충돌 시 재시도)
  type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
  let group: GroupRow | null = null;
  let groupError: { message: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode(8);
    const result = await supabase
      .from("groups")
      .insert({
        name: body.name.trim(),
        host_id: user.id,
        status: "voting",
        invite_code: code,
      })
      .select()
      .single();

    if (!result.error) {
      group = result.data;
      groupError = null;
      break;
    }
    // unique_violation (23505)인 경우만 재시도. invite_code 충돌 가능성.
    const pgErr = result.error as { code?: string; message: string };
    if (pgErr.code === "23505" && pgErr.message.includes("invite_code")) {
      continue;
    }
    groupError = result.error;
    break;
  }

  if (groupError || !group) {
    return NextResponse.json({ error: groupError?.message ?? "Failed to create group" }, { status: 500 });
  }

  // Add host + requested members.
  // group_members_insert_host RLS는 groups SELECT를 거치는데, groups_select_member가
  // 이미 멤버여야 보여줘서 호스트가 그룹을 막 만든 직후엔 chicken-and-egg로 막힘.
  // host_id는 위에서 RLS-validated insert로 user.id로 잠긴 상태 → admin client로
  // group_members만 RLS 우회해 안전하게 채움. memberIds는 클라이언트가 지정 가능하지만
  // group은 이미 host == user.id 임을 DB가 보장하므로 권한 상승 위험 없음.
  const admin = createAdminClient();
  const memberIds = [...new Set([user.id, ...(body.memberIds ?? [])])];
  const { error: memberError } = await admin
    .from("group_members")
    .insert(memberIds.map((uid) => ({ group_id: group.id, user_id: uid })));

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapGroup(group) }, { status: 201 });
}
