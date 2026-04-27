import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { mockCurrentUserId } from "@/lib/mock";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type AuthSuccess = { user: SupabaseUser; error: null };
type AuthFailure = { user: null; error: NextResponse };

export async function requireAuth(): Promise<AuthSuccess | AuthFailure> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    // 개발/데모 환경에서 Supabase 인증 없이 시연 가능하도록 mock 유저 폴백
    if (process.env.NODE_ENV === "development") {
      const mockUser = {
        id: mockCurrentUserId,
        email: "demo@ittae.app",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: { name: "데모 유저" },
        created_at: new Date().toISOString(),
      } as SupabaseUser;
      return { user: mockUser, error: null };
    }
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, error: null };
}
