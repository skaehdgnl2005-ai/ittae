"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  syncedAt: string | null;
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "방금";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}시간 전`;
  return `${Math.floor(diff / (24 * 60 * 60_000))}일 전`;
}

export function GoogleSyncIndicator({ syncedAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!syncedAt) return null;

  async function handleSync() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/google/sync", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={busy}
      className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 px-2 py-1 min-h-11 disabled:opacity-50"
      aria-label="Google 캘린더 동기화"
    >
      <RefreshCw size={12} className={busy ? "animate-spin" : ""} strokeWidth={2} />
      <span>{formatRelative(syncedAt)} 동기화</span>
    </button>
  );
}
