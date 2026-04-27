import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createHmac } from "crypto";
import type { Database } from "@/types/supabase";
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

export async function GET(request: NextRequest) {
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

  // 3. Supabase auth.users 에 합성 이메일로 가입 (idempotent)
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

  if (createError && !/already|registered|exists/i.test(createError.message)) {
    console.error("[kakao callback] createUser failed", createError);
    return NextResponse.redirect(
      `${origin}${ROUTES.LOGIN}?error=user_create_failed`
    );
  }

  // 4. 응답 객체에 직접 쿠키를 attach 하는 패턴 — Route Handler 에서
  //    NextResponse.redirect 를 별도로 만들면 cookies().set 결과가 누락됨.
  //    먼저 dummy redirect 응답을 만들고, signInWithPassword 가 set 하는
  //    쿠키를 그 응답에 직접 기록한 뒤 최종 redirect 로 교체한다.
  let response = NextResponse.redirect(`${origin}${ROUTES.HOME}`);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

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

  // 5. 프로필 존재 여부 확인 → 최종 redirect URL 결정
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", signInData.user.id)
    .single();

  const targetUrl = profile
    ? `${origin}${ROUTES.HOME}`
    : `${origin}${ROUTES.PROFILE_SETUP}`;

  // 쿠키를 유지한 채 최종 redirect 로 교체
  const finalResponse = NextResponse.redirect(targetUrl);
  response.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie);
  });
  response = finalResponse;

  return response;
}
