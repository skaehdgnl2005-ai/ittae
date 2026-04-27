import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { mapVoteSession } from "@/lib/mappers";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const body: {
    groupId: string;
    candidateDates: string[];
    deadline?: string | null;
  } = await request.json();

  const supabase = await createServerClient();

  // Verify user is a member (or host) of the group
  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", body.groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { data: session, error } = await supabase
    .from("vote_sessions")
    .insert({
      group_id: body.groupId,
      candidate_dates: body.candidateDates,
      deadline: body.deadline ?? null,
    })
    .select()
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: mapVoteSession(session) }, { status: 201 });
}
