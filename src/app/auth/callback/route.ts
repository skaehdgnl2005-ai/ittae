import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/routes";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? ROUTES.HOME;

  if (!code) {
    return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?error=missing_code`);
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?error=auth_failed`);
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
