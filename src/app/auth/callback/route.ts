import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/routes";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");
  const next = searchParams.get("next") ?? ROUTES.HOME;

  if (oauthError) {
    console.error("[auth/callback] OAuth provider error:", {
      error: oauthError,
      description: oauthErrorDesc,
      host: request.headers.get("host"),
    });
    const params = new URLSearchParams({
      error: "oauth_provider",
      reason: oauthError,
    });
    return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?${params}`);
  }

  if (!code) {
    console.error("[auth/callback] Missing code in callback URL", {
      url: request.url,
      host: request.headers.get("host"),
    });
    return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?error=missing_code`);
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession failed:", {
      message: error?.message,
      status: error?.status,
      name: error?.name,
      host: request.headers.get("host"),
      hasUser: !!data?.user,
    });
    const params = new URLSearchParams({
      error: "auth_failed",
      reason: error?.message ?? "no_user",
    });
    return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?${params}`);
  }

  // 신규 사용자 여부 확인 — users 테이블에 프로필 없으면 설정 화면으로
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(`${origin}${ROUTES.PROFILE_SETUP}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
