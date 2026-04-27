import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROUTES } from "@/lib/routes";

type KakaoTokenResponse = {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type KakaoUserResponse = {
  id?: number;
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
    };
  };
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  if (errorParam || !code) {
    return NextResponse.redirect(
      `${origin}${ROUTES.LOGIN}?error=${errorParam ?? "missing_code"}`
    );
  }

  // 1. 인가 코드 → Kakao access token 교환
  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KAKAO_REST_API_KEY!,
      redirect_uri: `${origin}${ROUTES.AUTH_CALLBACK_KAKAO}`,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as KakaoTokenResponse;
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("[kakao callback] token exchange failed", tokenData);
    return NextResponse.redirect(
      `${origin}${ROUTES.LOGIN}?error=kakao_token_failed`
    );
  }

  // 2. access token → 사용자 프로필 조회
  const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = (await userRes.json()) as KakaoUserResponse;
  if (!userRes.ok || !userData.id) {
    console.error("[kakao callback] user fetch failed", userData);
    return NextResponse.redirect(
      `${origin}${ROUTES.LOGIN}?error=kakao_user_failed`
    );
  }

  const kakaoId = String(userData.id);
  const nickname =
    userData.kakao_account?.profile?.nickname ??
    userData.properties?.nickname ??
    "";
  const avatarUrl =
    userData.kakao_account?.profile?.profile_image_url ??
    userData.properties?.profile_image ??
    null;

  // 3. Supabase auth.users 에 kakao 식별자로 합성 이메일 사용해 가입/로그인
  // (이메일 동의항목을 못 쓰므로 placeholder. UNIQUE 보장은 kakao_id 기반)
  const syntheticEmail = `kakao_${kakaoId}@kakao.local`;
  const password = createHmac(
    "sha256",
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
    .update(kakaoId)
    .digest("hex");

  const admin = createAdminClient();

  const { error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    user_metadata: {
      provider: "kakao",
      kakao_id: kakaoId,
      name: nickname,
      nickname,
      avatar_url: avatarUrl,
    },
  });

  // 이미 가입된 사용자는 createUser 가 에러를 반환 — 무시하고 로그인 시도
  if (createError && !/already|registered|exists/i.test(createError.message)) {
    console.error("[kakao callback] createUser failed", createError);
    return NextResponse.redirect(
      `${origin}${ROUTES.LOGIN}?error=user_create_failed`
    );
  }

  const supabase = await createServerClient();
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });

  if (signInError || !signInData.user) {
    console.error("[kakao callback] signIn failed", signInError);
    return NextResponse.redirect(
      `${origin}${ROUTES.LOGIN}?error=auth_failed`
    );
  }

  // 4. 프로필 존재 여부에 따라 라우팅
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", signInData.user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(`${origin}${ROUTES.PROFILE_SETUP}`);
  }

  return NextResponse.redirect(`${origin}${ROUTES.HOME}`);
}
