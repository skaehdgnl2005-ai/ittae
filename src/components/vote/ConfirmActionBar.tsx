"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BestTimeResult } from "@/lib/vote";

type ConfirmActionBarProps = {
  pickedSlot: BestTimeResult | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  /** true면 하단 BottomNav 위(bottom-[83px])에 띄움. 기본 true. */
  withBottomNav?: boolean;
};

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
}

export function ConfirmActionBar({
  pickedSlot,
  onCancel,
  onConfirm,
  withBottomNav = true,
}: ConfirmActionBarProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (confirming || !pickedSlot) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const previewText = pickedSlot
    ? `${formatDateShort(pickedSlot.date)} ${pickedSlot.startTime}~${pickedSlot.endTime}`
    : "순위 또는 시간표에서 선택";

  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 py-3 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800",
        withBottomNav ? "bottom-[83px]" : "bottom-0"
      )}
    >
      <div className="mb-2 px-1">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">선택한 시간</p>
        <p
          className={cn(
            "text-sm font-semibold truncate",
            pickedSlot
              ? "text-violet-700 dark:text-violet-300"
              : "text-gray-400 dark:text-gray-500"
          )}
        >
          {previewText}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={confirming}
          aria-label="취소"
          className="flex-1 h-[52px] rounded-xl text-[15px] font-semibold transition-all active:scale-[0.97] bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          취소
        </button>
        <button
          onClick={handleConfirm}
          disabled={!pickedSlot || confirming}
          aria-label="이 시간으로 확정"
          className={cn(
            "flex-[1.4] h-[52px] rounded-xl text-[15px] font-semibold transition-all active:scale-[0.97]",
            pickedSlot && !confirming
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
          )}
        >
          {confirming ? "확정 중..." : "이 시간으로 확정"}
        </button>
      </div>
    </div>
  );
}
