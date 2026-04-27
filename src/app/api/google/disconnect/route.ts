import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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

  const admin = createAdminClient();

  const { error: userErr } = await admin
    .from("users")
    .update({
      google_refresh_token: null,
      google_calendar_email: null,
      google_calendar_synced_at: null,
    })
    .eq("id", user.id);

  if (userErr) {
    return NextResponse.json({ ok: false, error: userErr.message });
  }

  const { error: delErr } = await admin
    .from("schedules")
    .delete()
    .eq("user_id", user.id)
    .eq("source", "google");

  if (delErr) {
    return NextResponse.json({ ok: false, error: delErr.message });
  }

  revalidatePath("/home");
  revalidatePath("/profile");
  return NextResponse.json({ ok: true });
}
