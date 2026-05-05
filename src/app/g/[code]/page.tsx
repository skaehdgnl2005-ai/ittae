import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GuestVoteClient } from "./GuestVoteClient";

type Props = { params: Promise<{ code: string }> };

export default async function GuestGroupPage({ params }: Props) {
  const { code } = await params;
  const admin = createAdminClient();

  // confirmed_start_time/end_time이 supabase types에 없을 수 있어 (any) 캐스팅.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: group } = await (admin as any)
    .from("groups")
    .select("id, name, status, confirmed_date, confirmed_start_time, confirmed_end_time")
    .eq("invite_code", code)
    .maybeSingle();

  if (!group) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
          유효하지 않은 링크예요
        </h1>
        <p className="text-sm text-gray-500">
          링크가 만료됐거나 잘못 입력된 것 같아요.
        </p>
      </div>
    );
  }

  // 이미 그 모임의 회원 멤버 → 회원 화면으로 redirect
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: membership } = await admin
      .from("group_members")
      .select("group_id")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership) {
      redirect(`/group/${group.id}`);
    }
  }

  // 모임 마감 → read-only 결과
  if (group.status !== "voting") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <span className="text-3xl mb-3">🎉</span>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {group.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">일정이 확정되었어요</p>
        {group.confirmed_date && (
          <p className="mt-3 text-base font-semibold text-violet-600 dark:text-violet-400">
            {group.confirmed_date}
            {group.confirmed_start_time &&
              ` ${group.confirmed_start_time}~${group.confirmed_end_time}`}
          </p>
        )}
      </div>
    );
  }

  return <GuestVoteClient code={code} groupId={group.id} groupName={group.name} />;
}
