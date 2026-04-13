import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { mapUser } from "@/lib/mappers";

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: sent }, { data: received }] = await Promise.all([
    supabase
      .from("friendships")
      .select("receiver_id")
      .eq("requester_id", user.id)
      .eq("status", "accepted"),
    supabase
      .from("friendships")
      .select("requester_id")
      .eq("receiver_id", user.id)
      .eq("status", "accepted"),
  ]);

  const friendIds = [
    ...(sent ?? []).map((f) => f.receiver_id),
    ...(received ?? []).map((f) => f.requester_id),
  ];

  if (friendIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: usersData, error } = await supabase
    .from("users")
    .select("*")
    .in("id", friendIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (usersData ?? []).map(mapUser) });
}

export async function POST(request: NextRequest) {
  const body: { receiverId: string } = await request.json();
  if (!body.receiverId) {
    return NextResponse.json({ error: "receiverId is required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (body.receiverId === user.id) {
    return NextResponse.json({ error: "Cannot send friend request to yourself" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("friendships")
    .insert({
      requester_id: user.id,
      receiver_id: body.receiverId,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
