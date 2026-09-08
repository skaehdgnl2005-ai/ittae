import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapGroup, mapUser, mapVoteSession, mapVote, mapTimeSlot, mapGuest } from "@/lib/mappers";
import type { Group, VoteSession, Vote, User, TimeSlot, Guest } from "@/types";
import { GroupDetailClient } from "./GroupDetailClient";
import { ROUTES } from "@/lib/routes";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.LOGIN);

  // Stage 1: 본인 멤버십 + 그룹 본체 + 최신 vote session 병렬.
  const [
    { data: membership },
    { data: groupRow },
    { data: sessionRow },
  ] = await Promise.all([
    supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("groups").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("vote_sessions")
      .select("*")
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!membership) notFound();
  if (!groupRow) notFound();

  // 본인이 그룹 멤버임이 확인됐으므로, 멤버 목록과 프로필은 admin client로 RLS 우회.
  // 이유:
  //   - group_members RLS는 자체참조 서브쿼리라 환경에 따라 본인 행만 반환할 수 있음.
  //   - users RLS는 본인 + 친구만 SELECT 허용 → 친구 아닌 그룹 멤버 프로필이 누락됨.
  // 그 결과 group.members.length 가 1로 잡혀 othersTotal=0이 되고 다른 사람 가용 색이 안 칠해진다.
  const adminClient = createAdminClient();
  const [
    { data: allMemberships },
    { data: guestRows },
  ] = await Promise.all([
    adminClient.from("group_members").select("user_id").eq("group_id", id),
    adminClient.from("group_guests").select("*").eq("group_id", id),
  ]);

  const memberIds = (allMemberships ?? []).map((m) => m.user_id);
  const guests: Guest[] = (guestRows ?? []).map(mapGuest);

  // Stage 2: 멤버 프로필(admin) + (세션 있으면) votes + time_slots(일반 RLS) 병렬.
  const [
    { data: usersData },
    { data: votesData },
    { data: timeSlotsData },
  ] = await Promise.all([
    memberIds.length > 0
      ? adminClient.from("users").select("*").in("id", memberIds)
      : Promise.resolve({ data: [] }),
    sessionRow
      ? supabase.from("votes").select("*").eq("session_id", sessionRow.id)
      : Promise.resolve({ data: [] }),
    sessionRow
      ? supabase.from("time_slots").select("*").eq("session_id", sessionRow.id)
      : Promise.resolve({ data: [] }),
  ]);

  const members: User[] = (usersData ?? []).map(mapUser);
  const group: Group = { ...mapGroup(groupRow), members, guests };

  if (!sessionRow) {
    return (
      <GroupDetailClient
        group={group}
        voteSession={null}
        initialVotes={[]}
        initialTimeSlots={[]}
        currentUserId={user.id}
      />
    );
  }

  const voteSession: VoteSession = mapVoteSession(sessionRow);
  const initialVotes: Vote[] = (votesData ?? []).map(mapVote);
  const initialTimeSlots: TimeSlot[] = (timeSlotsData ?? []).map(mapTimeSlot);

  return (
    <GroupDetailClient
      group={group}
      voteSession={voteSession}
      initialVotes={initialVotes}
      initialTimeSlots={initialTimeSlots}
      currentUserId={user.id}
    />
  );
}
