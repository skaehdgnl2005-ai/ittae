import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGuest } from "@/lib/supabase/guestAuth";
import { mapVote } from "@/lib/mappers";
import type { VoteChoice } from "@/types";

type Params = { params: Promise<{ code: string }> };

async function findSessionId(groupId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vote_sessions")
    .select("id")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function isVotingOpen(groupId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("groups")
    .select("status")
    .eq("id", groupId)
    .maybeSingle();
  return data?.status === "voting";
}

export async function POST(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const auth = await requireGuest(request, code);
  if ("error" in auth && auth.error) return auth.error;
  const { guestId, groupId } = auth as { guestId: string; groupId: string };

  if (!(await isVotingOpen(groupId))) {
    return NextResponse.json({ error: "모임이 마감되었어요" }, { status: 409 });
  }

  const body: { date: string; choice: string } = await request.json();
  if (body.choice === "maybe") {
    return NextResponse.json({ error: "maybe choice not supported" }, { status: 400 });
  }

  const sessionId = await findSessionId(groupId);
  if (!sessionId) {
    return NextResponse.json({ error: "No vote session" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: vote, error } = await admin
    .from("votes")
    .insert({
      session_id: sessionId,
      user_id: null,
      guest_id: guestId,
      date: body.date,
      choice: body.choice as VoteChoice,
      comment: null,
    })
    .select()
    .single();

  if (error || !vote) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: mapVote(vote) }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const auth = await requireGuest(request, code);
  if ("error" in auth && auth.error) return auth.error;
  const { guestId, groupId } = auth as { guestId: string; groupId: string };

  if (!(await isVotingOpen(groupId))) {
    return NextResponse.json({ error: "모임이 마감되었어요" }, { status: 409 });
  }

  const body: { date: string; choice: string } = await request.json();
  const sessionId = await findSessionId(groupId);
  if (!sessionId) {
    return NextResponse.json({ error: "No vote session" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: vote, error } = await admin
    .from("votes")
    .update({ choice: body.choice as VoteChoice })
    .eq("session_id", sessionId)
    .eq("guest_id", guestId)
    .eq("date", body.date)
    .select()
    .single();

  if (error || !vote) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: mapVote(vote) });
}
