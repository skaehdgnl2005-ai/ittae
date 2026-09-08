import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/routes";
import { LogoutButton } from "@/components/layout/LogoutButton";

export default async function ProfilePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  const { data: profile } = await supabase
    .from("users")
    .select("nickname, profile_image_url, status_message")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/profile/setup");
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-dvh">
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <Link
          href={ROUTES.HOME}
          className="text-sm text-gray-600 dark:text-gray-300 min-h-11 flex items-center"
        >
          ← 홈
        </Link>
        <h1 className="text-[17px] font-semibold text-gray-800 dark:text-gray-100">
          내 프로필
        </h1>
        <div className="w-10" />
      </div>

      <div className="px-5 mt-4 space-y-5">
        <section className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3">
          {profile.profile_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profile_image_url}
              alt={profile.nickname}
              className="h-12 w-12 rounded-full object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 truncate">
              {profile.nickname}
            </p>
            {profile.status_message && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {profile.status_message}
              </p>
            )}
          </div>
        </section>

        <section className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <LogoutButton />
        </section>
      </div>
    </div>
  );
}
