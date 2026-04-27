"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  connectedEmail: string | null;
};

export function GoogleConnectButton({ connectedEmail }: Props) {
  const [busy, setBusy] = useState(false);

  if (!connectedEmail) {
    return (
      <a href="/api/auth/google/connect" className="block">
        <Button variant="secondary">Google 캘린더 연결</Button>
      </a>
    );
  }

  async function handleDisconnect() {
    if (busy) return;
    if (!confirm("Google 캘린더 연결을 해제할까요? 가져온 일정도 모두 삭제됩니다.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" });
      if (res.ok) {
        location.reload();
      } else {
        alert("연결 해제에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 dark:text-gray-500">Google 캘린더</p>
        <p className="text-sm text-gray-800 dark:text-gray-100 truncate">{connectedEmail}</p>
      </div>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={busy}
        className="text-xs text-gray-500 dark:text-gray-400 underline shrink-0 min-h-11 px-2 disabled:opacity-50"
      >
        해제
      </button>
    </div>
  );
}
