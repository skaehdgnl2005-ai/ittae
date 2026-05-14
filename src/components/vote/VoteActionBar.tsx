"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type VoteActionBarProps = {
  hasMyVotes: boolean;
  hasSavedBefore: boolean;
  isHost: boolean;
  allVoted: boolean;
  onSaveMyVote: () => Promise<void>;
  onConfirm: () => void;
  /** true면 하단 BottomNav 위(bottom-[83px])에 띄움. false면 화면 하단(bottom-0). 기본 true. inline=true면 무시. */
  withBottomNav?: boolean;
  /** flex column 페이지 안에서 자연 흐름으로 배치할 때 true. fixed 포지셔닝 제거. */
  inline?: boolean;
  /** 내가 선택한 시간 구간 개수 (status line 표시용) */
  mySlotCount: number;
  /** 투표 완료한 참여자 수 (호스트 우측 버튼 라벨용) */
  votedCount: number;
  /** 전체 참여자 수 (호스트 우측 버튼 라벨용) */
  totalParticipants: number;
};

export function VoteActionBar({
  hasMyVotes,
  hasSavedBefore,
  isHost,
  allVoted,
  onSaveMyVote,
  onConfirm,
  withBottomNav = true,
  inline = false,
  mySlotCount,
  votedCount,
  totalParticipants,
}: VoteActionBarProps) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [savedOnceLocal, setSavedOnceLocal] = useState(false);
  const justSaved = savedAt > 0 && Date.now() - savedAt < 2900;
  const showAsResubmit = hasSavedBefore || savedOnceLocal;

  const handleSave = async () => {
    if (saving || !hasMyVotes) return;
    setSaving(true);
    try {
      await onSaveMyVote();
      setSavedAt(Date.now());
      setSavedOnceLocal(true);
      setTimeout(() => setSavedAt(0), 3000);
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = saving
    ? "저장 중..."
    : justSaved
      ? "저장됐어요!"
      : showAsResubmit
        ? "투표 수정하기"
        : "투표 등록하기";

  const savedShown = showAsResubmit && !justSaved;

  return (
    <div
      className={cn(
        "px-5 py-3 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800",
        inline
          ? "w-full"
          : cn(
              "fixed left-1/2 -translate-x-1/2 w-full max-w-[430px]",
              withBottomNav ? "bottom-[83px]" : "bottom-0"
            )
      )}
    >
      {savedShown && (
        <div
          role="status"
          aria-live="polite"
          className="mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 dark:bg-violet-900/20 dark:border-violet-800/60"
        >
          <Check
            size={14}
            strokeWidth={2.5}
            className="text-violet-600 dark:text-violet-400 shrink-0"
          />
          <span className="text-[12px] font-medium text-violet-700 dark:text-violet-300">
            내 투표 저장됨 · 시간 {mySlotCount}구간 선택
          </span>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasMyVotes || saving}
          aria-label={saveLabel}
          className={cn(
            "flex-1 h-[52px] rounded-xl text-[15px] font-semibold transition-all duration-300 active:scale-[0.97] flex items-center justify-center gap-1.5",
            justSaved
              ? "bg-violet-100 text-violet-700 ring-2 ring-violet-300/70 shadow-sm scale-[1.02] dark:bg-violet-900/40 dark:text-violet-200 dark:ring-violet-500/40"
              : !hasMyVotes
                ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
                : savedShown
                  ? "bg-white border border-violet-300 text-violet-700 hover:bg-violet-50 dark:bg-gray-900 dark:border-violet-700 dark:text-violet-300"
                  : "bg-violet-600 text-white hover:bg-violet-700"
          )}
        >
          {justSaved && <Check size={18} strokeWidth={2.4} />}
          {saveLabel}
        </button>

        {isHost && (
          <button
            onClick={onConfirm}
            disabled={!allVoted}
            aria-label={allVoted ? "일정 확정하러 가기" : `${totalParticipants}명 중 ${votedCount}명 투표 중`}
            className={cn(
              "flex-1 h-[52px] rounded-xl text-[15px] font-semibold transition-all active:scale-[0.97]",
              allVoted
                ? "bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
            )}
          >
            {allVoted
              ? "일정 확정하러 가기"
              : `${totalParticipants}명 중 ${votedCount}명 투표 중`}
          </button>
        )}
      </div>
    </div>
  );
}
