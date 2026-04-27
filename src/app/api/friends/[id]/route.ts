import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const body: { action: "accept" | "reject" } = await request.json();

  if (!body.action || !["accept", "reject"].includes(body.action)) {
    return NextResponse.json(
      { error: "action must be 'accept' or 'reject'" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();

  // Verify friendship exists and current user is the receiver
  const { data: friendship, error: fetchError } = await supabase
    .from("friendships")
    .select("*")
    .eq("id", id)
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .single();

  if (fetchError || !friendship) {
    return NextResponse.json({ error: "Friendship request not found" }, { status: 404 });
  }

  if (body.action === "accept") {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: { id, status: "accepted" } });
  } else {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: { id, status: "rejected" } });
  }
}
