"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type VoteActionBarProps = {
  hasMyVotes: boolean;
  isHost: boolean;
  allVoted: boolean;
  onSaveMyVote: () => Promise<void>;
  onConfirm: () => void;
};

export function VoteActionBar({
  hasMyVotes,
  isHost,
  allVoted,
  onSaveMyVote,
  onConfirm,
}: VoteActionBarProps) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const justSaved = savedAt > 0 && Date.now() - savedAt < 2400;

  const handleSave = async () => {
    if (saving || !hasMyVotes) return;
    setSaving(true);
    try {
      await onSaveMyVote();
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(0), 2500);
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = saving
    ? "저장 중..."
    : justSaved
      ? "저장됐어요!"
      : "내 투표 저장하기";

  return (
    <div className="fixed bottom-[83px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 py-3 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasMyVotes || saving}
          aria-label="내 투표 저장하기"
          className={cn(
            "flex-1 h-[52px] rounded-xl text-[15px] font-semibold transition-all active:scale-[0.97] flex items-center justify-center gap-1.5",
            justSaved
              ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
              : hasMyVotes
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
          )}
        >
          {justSaved && <Check size={18} strokeWidth={2.4} />}
          {saveLabel}
        </button>

        {isHost && (
          <button
            onClick={onConfirm}
            disabled={!allVoted}
            aria-label="일정 확정하기"
            className={cn(
              "flex-1 h-[52px] rounded-xl text-[15px] font-semibold transition-all active:scale-[0.97]",
              allVoted
                ? "bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
            )}
          >
            {allVoted ? "일정 확정하기" : "투표 대기 중"}
          </button>
        )}
      </div>
    </div>
  );
}
