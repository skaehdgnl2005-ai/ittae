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
        <Button variant="secondary">구글 캘린더 연결</Button>
      </a>
    );
  }

  async function handleDisconnect() {
    if (busy) return;
    if (!confirm(`구글 캘린더(${connectedEmail}) 연결을 해제할까요? 가져온 일정도 모두 삭제됩니다.`)) return;
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
    <Button variant="secondary" onClick={handleDisconnect} disabled={busy}>
      구글 캘린더 해제
    </Button>
  );
}
