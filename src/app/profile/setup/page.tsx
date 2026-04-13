import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ProfileSetupForm } from "./ProfileSetupForm";

export default async function ProfileSetupPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 이미 프로필이 있는 사용자는 홈으로
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .single();

  if (profile) {
    redirect("/home");
  }

  const nickname =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  return (
    <ProfileSetupForm
      userId={user.id}
      email={user.email ?? ""}
      defaultNickname={nickname}
      defaultAvatarUrl={avatarUrl}
    />
  );
}
