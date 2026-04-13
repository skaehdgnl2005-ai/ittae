"use client";
import { Button } from "@/components/ui/Button";

type StickyConfirmButtonProps = {
  allVoted: boolean;
  isHost: boolean;
  onConfirm: () => void;
};

export function StickyConfirmButton({ allVoted, isHost, onConfirm }: StickyConfirmButtonProps) {
  if (!isHost) return null;
  return (
    <div className="fixed bottom-[83px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 py-3 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <Button onClick={onConfirm} disabled={!allVoted}>
        {allVoted ? "일정 확정하기" : "투표 대기 중..."}
      </Button>
    </div>
  );
}
