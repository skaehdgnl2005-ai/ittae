// src/app/i/[code]/InviteAcceptCard.tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { sendFriendRequest } from "@/app/friends/actions";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types";

type Props = { target: PublicUser };

export function InviteAcceptCard({ target }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSend() {
    startTransition(async () => {
      const r = await sendFriendRequest(target.id);
      if (r.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
        setErrorMsg(r.error);
      }
    });
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <Avatar nickname={target.nickname} profileImageUrl={target.profileImageUrl} size="lg" />
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mt-4">
        {target.nickname}
      </h1>
      {target.statusMessage && (
        <p className="text-sm text-gray-500 mt-1">{target.statusMessage}</p>
      )}

      <div className="mt-8 w-full max-w-sm">
        {status === "sent" ? (
          <>
            <p className="text-sm text-violet-600 mb-4">친구 신청을 보냈어요</p>
            <button
              type="button"
              onClick={() => router.push(ROUTES.HOME)}
              className="w-full h-12 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700"
            >
              홈으로
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className={cn(
                "w-full h-12 rounded-xl text-sm font-semibold transition-colors",
                isPending
                  ? "bg-violet-600/40 text-white pointer-events-none"
                  : "bg-violet-600 text-white active:bg-violet-700"
              )}
            >
              {isPending ? "보내는 중..." : "친구 신청"}
            </button>
            {status === "error" && errorMsg && (
              <p className="text-xs text-red-500 mt-2">{errorMsg}</p>
            )}
            <Link
              href={ROUTES.HOME}
              className="block text-xs text-gray-400 mt-3"
            >
              홈으로
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
