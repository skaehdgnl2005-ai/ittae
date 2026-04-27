"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/invite-code";

type SetupProfileInput = {
  userId: string;
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
  statusMessage: string | null;
};

type SetupProfileResult = { success: boolean; error?: string };

const MAX_INVITE_CODE_RETRIES = 5;

export async function setupProfile({
  userId,
  email,
  nickname,
  profileImageUrl,
  statusMessage,
}: SetupProfileInput): Promise<SetupProfileResult> {
  console.log("[setupProfile] start", { userId, hasEmail: !!email, nickname });

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "로그인이 만료되었습니다. 다시 로그인해 주세요." };
    }

    // 기존 invite_code 보존: 이미 가지고 있다면 재생성하지 않는다.
    const { data: existing } = await supabase
      .from("users")
      .select("invite_code")
      .eq("id", userId)
      .maybeSingle();

    let inviteCode = existing?.invite_code ?? null;

    for (let attempt = 0; inviteCode == null && attempt < MAX_INVITE_CODE_RETRIES; attempt++) {
      const candidate = generateInviteCode();
      const payload = {
        id: userId,
        email: email && email.trim().length > 0 ? email : null,
        nickname,
        profile_image_url: profileImageUrl,
        status_message: statusMessage,
        invite_code: candidate,
      };
      const { error } = await supabase.from("users").upsert(payload);
      if (!error) {
        inviteCode = candidate;
        console.log("[setupProfile] upsert ok, invite_code", candidate);
        return { success: true };
      }
      // 23505 = unique_violation. invite_code 충돌이면 재시도, 아니면 즉시 실패.
      if (error.code !== "23505") {
        console.error("[setupProfile] upsert error", error);
        return { success: false, error: `${error.code ?? ""} ${error.message}`.trim() };
      }
      console.warn("[setupProfile] invite_code 충돌, 재시도", attempt + 1);
    }

    if (inviteCode == null) {
      return { success: false, error: "invite_code 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }

    // 이미 invite_code가 있던 사용자(닉네임/상태 메시지 갱신만)
    const payload = {
      id: userId,
      email: email && email.trim().length > 0 ? email : null,
      nickname,
      profile_image_url: profileImageUrl,
      status_message: statusMessage,
    };
    const { error } = await supabase.from("users").upsert(payload);
    if (error) {
      console.error("[setupProfile] upsert error", error);
      return { success: false, error: `${error.code ?? ""} ${error.message}`.trim() };
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[setupProfile] unexpected", msg);
    return { success: false, error: `예외 발생: ${msg}` };
  }
}
