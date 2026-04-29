import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { mapGroup, mapUser, mapVoteSession, mapVote, mapTimeSlot } from "@/lib/mappers";
import type { Group, VoteSession, Vote, User, TimeSlot } from "@/types";
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

  // Stage 1: 멤버십 + 그룹 본체 + 멤버 ID + 최신 vote session을 한 번에 병렬.
  // RLS가 비-멤버 접근을 자동 차단하므로, 멤버십 실패 시 어차피 다른 쿼리도 빈 결과.
  const [
    { data: membership },
    { data: groupRow },
    { data: allMemberships },
    { data: sessionRow },
  ] = await Promise.all([
    supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("groups").select("*").eq("id", id).maybeSingle(),
    supabase.from("group_members").select("user_id").eq("group_id", id),
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

  const memberIds = (allMemberships ?? []).map((m) => m.user_id);

  // Stage 2: 멤버 프로필 + (세션 있으면) votes + time_slots 병렬.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emptyResult: any = { data: [] };

  const [
    { data: usersData },
    { data: votesData },
    { data: timeSlotsData },
  ] = await Promise.all([
    memberIds.length > 0
      ? supabase.from("users").select("*").in("id", memberIds)
      : Promise.resolve(emptyResult),
    sessionRow
      ? supabase.from("votes").select("*").eq("session_id", sessionRow.id)
      : Promise.resolve(emptyResult),
    sessionRow
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("time_slots")
          .select("*")
          .eq("session_id", sessionRow.id)
      : Promise.resolve(emptyResult),
  ]);

  const members: User[] = (usersData ?? []).map(mapUser);
  const group: Group = { ...mapGroup(groupRow), members };

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialTimeSlots: TimeSlot[] = ((timeSlotsData ?? []) as any[]).map(mapTimeSlot);

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
