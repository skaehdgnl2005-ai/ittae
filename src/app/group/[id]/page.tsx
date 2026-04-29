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

  // Verify membership
  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) notFound();

  // Fetch group
  const { data: groupRow } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .single();

  if (!groupRow) notFound();

  // Fetch members
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
  const group: Group = { ...mapGroup(groupRow), members };

  // Fetch the most recent vote session for this group
  const { data: sessionRow } = await supabase
    .from("vote_sessions")
    .select("*")
    .eq("group_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  // Fetch initial votes
  const { data: votesData } = await supabase
    .from("votes")
    .select("*")
    .eq("session_id", sessionRow.id);

  const initialVotes: Vote[] = (votesData ?? []).map(mapVote);

  // Fetch initial time slots (time_slots not yet in generated Supabase types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: timeSlotsData } = await (supabase as any)
    .from("time_slots")
    .select("*")
    .eq("session_id", sessionRow.id);

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
