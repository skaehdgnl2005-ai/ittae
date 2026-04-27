"use server";

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ROUTES } from "@/lib/routes";

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
      redirectTo: `${origin}${ROUTES.AUTH_CALLBACK}`,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? "Google OAuth 초기화 실패");
  }

  redirect(data.url);
}

export async function signInWithKakao() {
  const origin = await getOrigin();

  // Supabase Kakao provider 우회 — 비사업자 앱은 account_email 동의항목을 켤 수 없는데
  // Supabase가 기본 스코프에 account_email 을 강제로 합쳐 보내 KOE205 가 발생하기 때문.
  // 카카오 OAuth 를 직접 호출하고 callback 에서 Supabase 세션을 수립한다.
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_REST_API_KEY!,
    redirect_uri: `${origin}${ROUTES.AUTH_CALLBACK_KAKAO}`,
    response_type: "code",
    scope: "profile_nickname profile_image",
  });

  redirect(`https://kauth.kakao.com/oauth/authorize?${params.toString()}`);
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect(ROUTES.LOGIN);
}
