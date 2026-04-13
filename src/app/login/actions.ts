"use server";

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function signInWithGoogle() {
  const origin = await getOrigin();
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? "Google OAuth 초기화 실패");
  }

  redirect(data.url);
}

export async function signInWithKakao() {
  const origin = await getOrigin();
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? "Kakao OAuth 초기화 실패");
  }

  redirect(data.url);
}
