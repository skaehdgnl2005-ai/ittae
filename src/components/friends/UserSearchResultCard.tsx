// src/components/friends/UserSearchResultCard.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { sendFriendRequest } from "@/app/friends/actions";
import type { UserSearchResult } from "@/types";

type Props = {
  user: UserSearchResult;
};

export function UserSearchResultCard({ user }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<UserSearchResult["relationship"]>(
    user.relationship
  );
  const [toast, setToast] = useState<string | null>(null);

  function handleSend() {
    startTransition(async () => {
      const result = await sendFriendRequest(user.id);
      if (result.ok) {
        setStatus("pending_sent");
        setToast("친구 신청을 보냈어요");
      } else {
        setToast(result.error);
      }
      router.refresh();
    });
  }

  function handleReceivedHint() {
    setToast("친구 탭 상단의 받은 요청에서 수락하세요");
  }

  const config = (() => {
    switch (status) {
      case "none":
        return { label: "친구 신청", disabled: false, onClick: handleSend };
      case "pending_sent":
        return { label: "신청 보냄", disabled: true, onClick: () => {} };
      case "pending_received":
        return {
          label: "받은 요청 있음",
          disabled: false,
          onClick: handleReceivedHint,
        };
      case "accepted":
        return { label: "친구", disabled: true, onClick: () => {} };
    }
  })();

  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar nickname={user.nickname} profileImageUrl={user.profileImageUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {user.nickname}
        </p>
        {user.statusMessage && (
          <p className="text-xs text-gray-400 truncate">{user.statusMessage}</p>
        )}
        {toast && <p className="text-xs text-violet-600 mt-0.5">{toast}</p>}
      </div>
      <button
        type="button"
        onClick={config.onClick}
        disabled={config.disabled || isPending}
        className={cn(
          "min-h-11 px-3 rounded-lg text-xs font-medium transition-colors",
          config.disabled
            ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
            : "bg-violet-600 text-white active:bg-violet-700"
        )}
      >
        {config.label}
      </button>
    </div>
  );
}
