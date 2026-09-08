import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  extractEmailFromIdToken,
} from "@/lib/google/oauth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncUserGoogleCalendar } from "@/lib/google/sync";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/home?google=invalid", req.url));
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch {
    return NextResponse.redirect(new URL("/home?google=error", req.url));
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      new URL("/home?google=norefresh", req.url)
    );
  }

  const email = extractEmailFromIdToken(tokens.id_token);

  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("users")
    .update({
      google_refresh_token: tokens.refresh_token,
      google_calendar_email: email,
    })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.redirect(new URL("/home?google=db_error", req.url));
  }

  await syncUserGoogleCalendar(user.id);

  const res = NextResponse.redirect(
    new URL("/home?google=connected", req.url)
  );
  res.cookies.delete("google_oauth_state");
  return res;
}
