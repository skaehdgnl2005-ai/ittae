// src/components/friends/PendingRequestsSection.tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import {
  acceptFriendRequest,
  rejectFriendRequest,
} from "@/app/friends/actions";
import type { PendingFriendRequest } from "@/types";

type Props = {
  requests: PendingFriendRequest[];
};

export function PendingRequestsSection({ requests }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  function handleAccept(requesterId: string) {
    startTransition(async () => {
      await acceptFriendRequest(requesterId);
      router.refresh();
    });
  }

  function handleReject(requesterId: string) {
    startTransition(async () => {
      await rejectFriendRequest(requesterId);
      router.refresh();
    });
  }

  return (
    <section className="px-5 py-3 bg-violet-50/60 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900">
      <p className="text-[12px] font-medium text-violet-700 dark:text-violet-300 mb-2">
        받은 친구 요청 {requests.length}건
      </p>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.requesterId} className="flex items-center gap-3 py-1">
            <Avatar
              nickname={r.requester.nickname}
              profileImageUrl={r.requester.profileImageUrl}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {r.requester.nickname}
              </p>
              {r.requester.statusMessage && (
                <p className="text-xs text-gray-400 truncate">
                  {r.requester.statusMessage}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleAccept(r.requesterId)}
              disabled={isPending}
              className={cn(
                "min-h-11 px-3 rounded-lg text-xs font-medium",
                "bg-violet-600 text-white active:bg-violet-700"
              )}
            >
              수락
            </button>
            <button
              type="button"
              onClick={() => handleReject(r.requesterId)}
              disabled={isPending}
              className={cn(
                "min-h-11 px-3 rounded-lg text-xs font-medium",
                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              )}
            >
              거절
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
