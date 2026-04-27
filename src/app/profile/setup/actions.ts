"use server";

import { createServerClient } from "@/lib/supabase/server";

type SetupProfileInput = {
  userId: string;
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
  statusMessage: string | null;
};

type SetupProfileResult = {
  success: boolean;
  error?: string;
};

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
    console.log("[setupProfile] auth user", user?.id, "vs userId", userId);

    if (!user) {
      return { success: false, error: "로그인이 만료되었습니다. 다시 로그인해 주세요." };
    }

    const payload = {
      id: userId,
      email: email && email.trim().length > 0 ? email : null,
      nickname,
      profile_image_url: profileImageUrl,
      status_message: statusMessage,
    };

    const { error } = await supabase.from("users").upsert(payload);

    if (error) {
      console.error("[setupProfile] upsert error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return { success: false, error: `${error.code ?? ""} ${error.message}`.trim() };
    }

    console.log("[setupProfile] success");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[setupProfile] unexpected", msg);
    return { success: false, error: `예외 발생: ${msg}` };
  }
}
