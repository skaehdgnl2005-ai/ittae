"use client";
import { useState } from "react";
import { VoteMatrix } from "@/components/vote/VoteMatrix";
import { BestDateBanner } from "@/components/vote/BestDateBanner";
import { StickyConfirmButton } from "@/components/vote/StickyConfirmButton";
import { CommentSection } from "@/components/vote/CommentSection";
import { getBestDate, isAllVoted } from "@/lib/vote";
import { mockGroups, mockVoteSession, mockVotes, mockCurrentUserId } from "@/lib/mock";
import type { Vote, VoteChoice } from "@/types";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function GroupDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const group = mockGroups.find((g) => g.id === params.id) ?? mockGroups[0];
  const [votes, setVotes] = useState<Vote[]>(mockVotes);

  const handleVote = (date: string, choice: VoteChoice) => {
    setVotes((prev) => {
      const existing = prev.findIndex((v) => v.userId === mockCurrentUserId && v.date === date);
      if (existing >= 0) {
        return prev.map((v, i) => (i === existing ? { ...v, choice } : v));
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          sessionId: mockVoteSession.id,
          userId: mockCurrentUserId,
          date,
          choice,
          comment: null,
        },
      ];
    });
  };

  const bestDate = getBestDate(mockVoteSession, votes);
  const memberIds = group.members.map((m) => m.id);
  const allVoted = isAllVoted(mockVoteSession, votes, memberIds);
  const isHost = group.hostId === mockCurrentUserId;

  return (
    <div className="bg-gray-50 min-h-dvh pb-[140px] dark:bg-gray-950">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <button onClick={() => router.back()} aria-label="뒤로" className="min-h-11 min-w-11 flex items-center justify-center -ml-2">
          <ChevronLeft size={24} className="text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{group.name}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{group.members.length}명 참여</p>
        </div>
      </div>

      <div className="px-5 mt-4">
        <VoteMatrix
          session={mockVoteSession}
          votes={votes}
          members={group.members}
          currentUserId={mockCurrentUserId}
          onVote={handleVote}
        />
      </div>

      <BestDateBanner date={bestDate} />
      <CommentSection votes={votes} members={group.members} />

      <StickyConfirmButton
        allVoted={allVoted}
        isHost={isHost}
        onConfirm={() => alert("일정이 확정됩니다!")}
      />
    </div>
  );
}
