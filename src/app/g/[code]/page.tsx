import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGroupByInviteCode } from "@/lib/groups/getGroupByInviteCode";
import { GuestVoteClient } from "./GuestVoteClient";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const { code } = await params;
  const group = await getGroupByInviteCode(code);
  if (!group) return {};

  const isVoting = group.status === "voting";
  const title = isVoting
    ? `${group.name} 투표가 도착했어요`
    : `${group.name} — 투표가 종료됐어요`;
  const description = isVoting
    ? "가능한 시간을 골라주세요"
    : "탭해서 확정된 일정 보기";

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function GuestGroupPage({ params }: Props) {
  const { code } = await params;
  const group = await getGroupByInviteCode(code);

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
    const admin = createAdminClient();
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
