import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGuest } from "@/lib/supabase/guestAuth";
import {
  mapGroup,
  mapVoteSession,
  mapVote,
  mapTimeSlot,
  mapUser,
  mapGuest,
} from "@/lib/mappers";

type Params = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: Params) {
  const { code } = await params;
  const auth = await requireGuest(request, code);
  if ("error" in auth && auth.error) return auth.error;
  const { groupId, guestId } = auth as {
    groupId: string;
    guestId: string;
  };

  const admin = createAdminClient();

  const [
    { data: groupRow },
    { data: sessionRow },
    { data: memberships },
    { data: guestRows },
  ] = await Promise.all([
    admin.from("groups").select("*").eq("id", groupId).maybeSingle(),
    admin
      .from("vote_sessions")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("group_members").select("user_id").eq("group_id", groupId),
    admin.from("group_guests").select("*").eq("group_id", groupId),
  ]);

  if (!groupRow) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const memberIds = (memberships ?? []).map((m) => m.user_id);
  const usersResult = memberIds.length
    ? await admin.from("users").select("*").in("id", memberIds)
    : { data: [] as Awaited<ReturnType<typeof admin.from>>["data"] };

  const users = (usersResult.data ?? []).map(mapUser);
  const guests = (guestRows ?? []).map(mapGuest);

  let votes: ReturnType<typeof mapVote>[] = [];
  let timeSlots: ReturnType<typeof mapTimeSlot>[] = [];
  if (sessionRow) {
    const [{ data: voteRows }, tsResult] = await Promise.all([
      admin.from("votes").select("*").eq("session_id", sessionRow.id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from("time_slots").select("*").eq("session_id", sessionRow.id),
    ]);
    votes = (voteRows ?? []).map(mapVote);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    timeSlots = ((tsResult.data ?? []) as any[]).map(mapTimeSlot);
  }

  return NextResponse.json({
    data: {
      group: {
        ...mapGroup(groupRow),
        members: users,
        guests,
      },
      voteSession: sessionRow ? mapVoteSession(sessionRow) : null,
      votes,
      timeSlots,
      currentGuestId: guestId,
    },
  });
}
