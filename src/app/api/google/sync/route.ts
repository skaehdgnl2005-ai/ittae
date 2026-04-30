import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncUserGoogleCalendar } from "@/lib/google/sync";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const result = await syncUserGoogleCalendar(user.id);
  return NextResponse.json(result);
}
