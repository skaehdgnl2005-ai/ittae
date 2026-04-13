"use client";
import { cn } from "@/lib/utils";
import type { VoteChoice } from "@/types";

type VoteCellProps = {
  choice: VoteChoice | null;
  isCurrentUser: boolean;
  onClick?: () => void;
};

const choiceConfig: Record<VoteChoice, { symbol: string; className: string }> = {
  available:   { symbol: "⭕", className: "text-violet-500" },
  maybe:       { symbol: "△",  className: "text-amber-400" },
  unavailable: { symbol: "✕",  className: "text-gray-300" },
};

const choiceLabel: Record<string, string> = {
  available: "가능",
  maybe: "애매",
  unavailable: "불가",
};

export function VoteCell({ choice, isCurrentUser, onClick }: VoteCellProps) {
  return (
    <button
      onClick={onClick}
      disabled={!isCurrentUser}
      aria-label={choice ? choiceLabel[choice] : "미투표"}
      className={cn(
        "w-full h-11 flex items-center justify-center text-lg",
        isCurrentUser && "active:bg-gray-50 dark:active:bg-gray-800 transition-colors",
        !isCurrentUser && "cursor-default"
      )}
    >
      {choice ? (
        <span className={choiceConfig[choice].className}>
          {choiceConfig[choice].symbol}
        </span>
      ) : (
        <span className="text-gray-200 text-sm">—</span>
      )}
    </button>
  );
}
