"use server";

import { createServerClient } from "@/lib/supabase/server";

type SetupProfileInput = {
  userId: string;
  email: string;
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
  const supabase = await createServerClient();

  const { error } = await supabase.from("users").upsert({
    id: userId,
    email,
    nickname,
    profile_image_url: profileImageUrl,
    status_message: statusMessage,
  });

  if (error) {
    console.error("[setupProfile] Supabase error:", error.code, error.message, error.details);
    return { success: false, error: error.message };
  }

  return { success: true };
}
