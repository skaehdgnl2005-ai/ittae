import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { mapMemory, mapUser } from "@/lib/mappers";
import type { Memory, User } from "@/types";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const supabase = await createServerClient();

  // 현재 사용자가 속한 그룹 조회
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

  // 해당 그룹의 memories 최신순 조회
  const { data: memoryRows, error: memoryError } = await supabase
    .from("memories")
    .select("*")
    .in("group_id", groupIds)
    .order("date", { ascending: false });

  if (memoryError) {
    return NextResponse.json({ error: memoryError.message }, { status: 500 });
  }

  // 참여자(group_members → users) 배치 조회
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

  const participantsByGroup = (allMemberships ?? []).reduce<
    Record<string, User[]>
  >((acc, m) => {
    if (!acc[m.group_id]) acc[m.group_id] = [];
    const member = userMap[m.user_id];
    if (member) acc[m.group_id].push(member);
    return acc;
  }, {});

  const memories: Memory[] = (memoryRows ?? []).map((row) => ({
    ...mapMemory(row),
    participants: participantsByGroup[row.group_id] ?? [],
  }));

  return NextResponse.json({ data: memories });
}

type CreateMemoryBody = {
  date: string;
  group_id: string;
  place_id?: string;
  note?: string;
};

export async function POST(request: NextRequest) {
  const body: CreateMemoryBody = await request.json();

  if (!body.date || !body.group_id) {
    return NextResponse.json(
      { error: "date and group_id are required" },
      { status: 400 }
    );
  }

  const postAuth = await requireAuth();
  if (postAuth.error) return postAuth.error;
  const { user } = postAuth;

  const supabase = await createServerClient();

  // 해당 그룹의 멤버인지 확인 (RLS 보조)
  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", body.group_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: memory, error } = await supabase
    .from("memories")
    .insert({
      date: body.date,
      group_id: body.group_id,
      place_id: body.place_id ?? null,
      note: body.note ?? null,
      photos: [],
    })
    .select()
    .single();

  if (error || !memory) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create memory" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: mapMemory(memory) }, { status: 201 });
}
