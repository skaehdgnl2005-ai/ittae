import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const body: { nickname?: string; browserToken?: string } = await request.json();

  const nickname = body.nickname?.trim();
  const browserToken = body.browserToken;
  if (!nickname || !browserToken) {
    return NextResponse.json(
      { error: "nickname and browserToken required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: group } = await admin
    .from("groups")
    .select("id, status")
    .eq("invite_code", code)
    .maybeSingle();
  if (!group) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }
  if (group.status !== "voting") {
    return NextResponse.json(
      { error: "이 모임은 더 이상 투표를 받지 않아요" },
      { status: 409 }
    );
  }

  // 이미 등록된 토큰이면 닉네임만 갱신.
  const { data: existing } = await admin
    .from("group_guests")
    .select("id, nickname")
    .eq("group_id", group.id)
    .eq("browser_token", browserToken)
    .maybeSingle();

  if (existing) {
    if (existing.nickname !== nickname) {
      await admin
        .from("group_guests")
        .update({ nickname })
        .eq("id", existing.id);
    }
    return NextResponse.json({
      data: { guestId: existing.id, nickname },
    });
  }

  const { data: inserted, error: insErr } = await admin
    .from("group_guests")
    .insert({
      group_id: group.id,
      nickname,
      browser_token: browserToken,
    })
    .select("id, nickname")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: insErr?.message ?? "Failed to create guest" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { data: { guestId: inserted.id, nickname: inserted.nickname } },
    { status: 201 }
  );
}
