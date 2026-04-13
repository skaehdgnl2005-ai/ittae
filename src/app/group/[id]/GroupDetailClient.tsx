"use client";

import { useRouter } from "next/navigation";
import { VoteMatrix } from "@/components/vote/VoteMatrix";
import { BestDateBanner } from "@/components/vote/BestDateBanner";
import { StickyConfirmButton } from "@/components/vote/StickyConfirmButton";
import { CommentSection } from "@/components/vote/CommentSection";
import { useVoteRealtime } from "@/hooks/useVoteRealtime";
import { getBestDate, isAllVoted } from "@/lib/vote";
import type { Vote, VoteChoice, VoteSession, Group } from "@/types";
import { ChevronLeft } from "lucide-react";

type Props = {
  group: Group;
  voteSession: VoteSession | null;
  initialVotes: Vote[];
  currentUserId: string;
};

export function GroupDetailClient({
  group,
  voteSession,
  initialVotes,
  currentUserId,
}: Props) {
  const router = useRouter();
  const votes = useVoteRealtime(voteSession?.id ?? "", initialVotes);

  const handleVote = async (date: string, choice: VoteChoice) => {
    if (!voteSession) return;
    const existing = votes.find(
      (v) => v.userId === currentUserId && v.date === date
    );
    const method = existing ? "PATCH" : "POST";
    await fetch(`/api/vote-sessions/${voteSession.id}/votes`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, choice }),
    });
  };

  const handleConfirm = async () => {
    const best = voteSession ? getBestDate(voteSession, votes) : null;
    if (!best) return;
    await fetch(`/api/groups/${group.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmedDate: best }),
    });
    router.refresh();
  };

  const bestDate = voteSession ? getBestDate(voteSession, votes) : null;
  const memberIds = group.members.map((m) => m.id);
  const allVoted = voteSession
    ? isAllVoted(voteSession, votes, memberIds)
    : false;
  const isHost = group.hostId === currentUserId;

  return (
    <div className="bg-gray-50 min-h-dvh pb-[140px] dark:bg-gray-950">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <button
          onClick={() => router.back()}
          aria-label="뒤로"
          className="min-h-11 min-w-11 flex items-center justify-center -ml-2"
        >
          <ChevronLeft
            size={24}
            className="text-gray-700 dark:text-gray-300"
            strokeWidth={1.5}
          />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {group.name}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {group.members.length}명 참여
          </p>
        </div>
      </div>

      {voteSession ? (
        <>
          <div className="px-5 mt-4">
            <VoteMatrix
              session={voteSession}
              votes={votes}
              members={group.members}
              currentUserId={currentUserId}
              onVote={handleVote}
            />
          </div>
          <BestDateBanner date={bestDate} />
          <CommentSection votes={votes} members={group.members} />
          <StickyConfirmButton
            allVoted={allVoted}
            isHost={isHost}
            onConfirm={handleConfirm}
          />
        </>
      ) : (
        <p className="px-5 mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          투표 세션이 없습니다.
        </p>
      )}
    </div>
  );
}
