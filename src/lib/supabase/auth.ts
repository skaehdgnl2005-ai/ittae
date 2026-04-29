import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
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
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, error: null };
}
