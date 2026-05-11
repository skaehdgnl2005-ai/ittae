import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";
import { PUBLIC_PATHS, ROUTES } from "@/lib/routes";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname, searchParams } = request.nextUrl;

  // OAuth 콜백 구조 방어: Supabase Site URL 이 잘못 설정돼 /auth/callback 이 아닌 경로로
  // ?code=... 가 실려 들어오는 케이스만 콜백 라우터로 강제 라우팅한다.
  // 정상적으로 ?error= 를 받는 /login, callback 본인, API 라우트는 제외.
  const hasOAuthCode = searchParams.has("code") && searchParams.has("state");
  const isAuthPath =
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname === "/login";
  if (hasOAuthCode && !isAuthPath) {
    const callbackUrl = new URL("/auth/callback", request.url);
    searchParams.forEach((v, k) => callbackUrl.searchParams.set(k, v));
    console.warn("[middleware] OAuth code on wrong path, rerouting:", {
      from: pathname,
      to: callbackUrl.pathname,
    });
    return NextResponse.redirect(callbackUrl);
  }

  // getUser()는 서버에서 토큰을 검증 — getSession()보다 안전
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic =
    pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    // 개발 환경에서는 인증 없이도 접근 허용 (데모 시연용)
    if (process.env.NODE_ENV === "development") {
      return supabaseResponse;
    }
    console.warn("[middleware] no session, redirecting to /login:", {
      from: pathname,
      query: request.nextUrl.search,
    });
    const loginUrl = new URL(ROUTES.LOGIN, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // 정적 파일, 이미지 최적화, favicon 제외한 모든 경로
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
