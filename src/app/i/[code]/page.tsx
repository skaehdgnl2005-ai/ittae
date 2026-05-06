// src/app/i/[code]/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getInviteUserByCode } from "@/app/friends/actions";
import { Avatar } from "@/components/ui/Avatar";
import { ROUTES } from "@/lib/routes";
import { InviteAcceptCard } from "./InviteAcceptCard";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const { code } = await params;
  const target = await getInviteUserByCode(code);
  if (!target) return {};

  const nickname = target.nickname?.trim() || "친구";
  const title = `${nickname}님이 친구 추가 요청을 보냈어요`;
  const description = "된다에서 함께 모임을 잡아봐요";

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function InvitePage({ params }: Props) {
  const { code } = await params;

  const target = await getInviteUserByCode(code);

  if (!target) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
          유효하지 않은 초대 링크예요
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          링크가 만료됐거나 잘못 입력된 것 같아요.
        </p>
        <Link
          href={ROUTES.HOME}
          className="text-sm text-violet-600 underline"
        >
          홈으로
        </Link>
      </div>
    );
  }

  // 비로그인 → 로그인 후 같은 경로로 복귀
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = ROUTES.INVITE(code);
    redirect(`${ROUTES.LOGIN}?next=${encodeURIComponent(next)}`);
  }

  // 본인 코드 — 안내만
  if (user.id === target.id) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <Avatar nickname={target.nickname} profileImageUrl={target.profileImageUrl} size="lg" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mt-4 mb-1">
          내 초대 링크예요
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          친구에게 이 링크를 공유해 보세요.
        </p>
        <Link
          href={ROUTES.HOME}
          className="text-sm text-violet-600 underline"
        >
          홈으로
        </Link>
      </div>
    );
  }

  return <InviteAcceptCard target={target} />;
}
