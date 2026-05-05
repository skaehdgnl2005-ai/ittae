import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type GuestSuccess = {
  guestId: string;
  groupId: string;
  nickname: string;
  error: null;
};
type GuestFailure = { error: NextResponse };

export async function requireGuest(
  request: Request,
  inviteCode: string
): Promise<GuestSuccess | GuestFailure> {
  const token = request.headers.get("x-guest-token");
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing guest token" },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();

  const { data: group } = await admin
    .from("groups")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!group) {
    return {
      error: NextResponse.json({ error: "Invalid invite code" }, { status: 404 }),
    };
  }

  const { data: guest } = await admin
    .from("group_guests")
    .select("id, nickname")
    .eq("group_id", group.id)
    .eq("browser_token", token)
    .maybeSingle();

  if (!guest) {
    return {
      error: NextResponse.json({ error: "Guest not found" }, { status: 401 }),
    };
  }

  return {
    guestId: guest.id,
    groupId: group.id,
    nickname: guest.nickname,
    error: null,
  };
}
