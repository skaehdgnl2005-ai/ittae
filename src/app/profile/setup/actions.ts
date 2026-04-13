"use server";

import { createServerClient } from "@/lib/supabase/server";

type SetupProfileInput = {
  userId: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  statusMessage: string | null;
};

export async function setupProfile({
  userId,
  email,
  nickname,
  profileImageUrl,
  statusMessage,
}: SetupProfileInput) {
  const supabase = await createServerClient();

  const { error } = await supabase.from("users").upsert({
    id: userId,
    email,
    nickname,
    profile_image_url: profileImageUrl,
    status_message: statusMessage,
  });

  if (error) {
    throw new Error(error.message);
  }
}
