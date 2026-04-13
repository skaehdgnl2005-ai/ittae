import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { mapVote } from "@/lib/mappers";
import type { VoteChoice } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id: sessionId } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: votes, error } = await supabase
    .from("votes")
    .select("*")
    .eq("session_id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (votes ?? []).map(mapVote) });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: sessionId } = await params;
  const body: { date: string; choice: VoteChoice; comment?: string | null } =
    await request.json();

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: vote, error } = await supabase
    .from("votes")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      date: body.date,
      choice: body.choice,
      comment: body.comment ?? null,
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
  const { id: sessionId } = await params;
  const body: { date: string; choice: VoteChoice; comment?: string | null } =
    await request.json();

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: vote, error } = await supabase
    .from("votes")
    .update({
      choice: body.choice,
      comment: body.comment ?? null,
    })
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
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
