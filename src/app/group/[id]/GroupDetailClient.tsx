"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DateToggleRow } from "@/components/vote/DateToggleRow";
import { BestTimeBanner } from "@/components/vote/BestTimeBanner";
import { TimeGrid } from "@/components/vote/TimeGrid";
import { VoteActionBar } from "@/components/vote/VoteActionBar";
import { WelcomeVoteBanner } from "@/components/vote/WelcomeVoteBanner";
import { CommentSection } from "@/components/vote/CommentSection";
import { useVoteRealtime } from "@/hooks/useVoteRealtime";
import { useTimeSlotSelection } from "@/hooks/useTimeSlotSelection";
import { getBestDate, getBestTimeSlot, getRankedTimeSlots, isAllVoted } from "@/lib/vote";
import type { Vote, VoteChoice, VoteSession, Group, TimeSlot } from "@/types";
import { ChevronLeft, Link2, Check } from "lucide-react";

type Props = {
  group: Group;
  voteSession: VoteSession | null;
  initialVotes: Vote[];
  initialTimeSlots?: TimeSlot[];
  currentUserId: string;
};

/** 날짜 투표를 순환: null → available → unavailable → null */
function cycleDateChoice(current: VoteChoice | null): VoteChoice | null {
  if (current === null) return "available";
  if (current === "available") return "unavailable";
  return null;
}

export function GroupDetailClient({
  group,
  voteSession,
  initialVotes,
  initialTimeSlots = [],
  currentUserId,
}: Props) {
  const router = useRouter();

  const { votes, timeSlots: allTimeSlots } = useVoteRealtime(
    voteSession?.id ?? "",
    initialVotes,
    initialTimeSlots
  );

  const [dateChoices, setDateChoices] = useState<Record<string, VoteChoice | null>>(() => {
    const map: Record<string, VoteChoice | null> = {};
    if (voteSession) {
      voteSession.candidateDates.forEach((d) => {
        const v = initialVotes.find((vote) => vote.userId === currentUserId && vote.date === d);
        map[d] = v?.choice ?? null;
      });
    }
    return map;
  });

  const myInitialSlots = useMemo(
    () => initialTimeSlots.filter((s) => s.userId === currentUserId),
    [initialTimeSlots, currentUserId]
  );
  const {
    pendingStart,
    handleCellClick,
    commitSweptSlots,
    isSlotSelected,
    getSelectedRanges,
    rangesByDate,
    pendingPersist,
  } = useTimeSlotSelection(myInitialSlots);

  const handleDateToggle = useCallback(
    async (date: string) => {
      const current = dateChoices[date] ?? null;
      const next = cycleDateChoice(current);

      setDateChoices((prev) => ({ ...prev, [date]: next }));

      if (!voteSession) return;

      if (next === null) {
        // TODO: DELETE vote endpoint (not in current API — skip for MVP)
        return;
      }

      const existing = votes.find(
        (v) => v.userId === currentUserId && v.date === date
      );
      const method = existing ? "PATCH" : "POST";
      await fetch(`/api/vote-sessions/${voteSession.id}/votes`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, choice: next }),
      });
    },
    [dateChoices, voteSession, currentUserId, votes]
  );

  const handleTimeSlotClick = useCallback(
    (date: string, time: string) => {
      handleCellClick(date, time);
    },
    [handleCellClick]
  );

  // 사용자가 시간 슬롯을 직접 변경했을 때만 (마운트 시점 PUT 발사 X) 서버에 저장.
  // pendingPersist.nonce는 사용자 액션이 있을 때만 증가한다.
  const lastPersistedNonce = useRef(0);
  useEffect(() => {
    if (!voteSession) return;
    if (pendingPersist.nonce === 0) return;
    if (pendingPersist.nonce === lastPersistedNonce.current) return;
    lastPersistedNonce.current = pendingPersist.nonce;

    const sessionId = voteSession.id;
    for (const date of pendingPersist.dates) {
      const ranges = getSelectedRanges(date);
      fetch(`/api/vote-sessions/${sessionId}/time-slots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          slots: ranges.map((r) => ({
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        }),
      });
    }
  }, [pendingPersist, voteSession, getSelectedRanges]);

  const handleMyVoteSave = useCallback(async () => {
    if (!voteSession) return;

    const datePromises = Object.entries(dateChoices)
      .filter(([, choice]) => choice !== null)
      .map(([date, choice]) => {
        const existing = votes.find(
          (v) => v.userId === currentUserId && v.date === date
        );
        const method = existing ? "PATCH" : "POST";
        return fetch(`/api/vote-sessions/${voteSession.id}/votes`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, choice }),
        });
      });

    const slotPromises = voteSession.candidateDates.map((date) => {
      const ranges = getSelectedRanges(date);
      return fetch(`/api/vote-sessions/${voteSession.id}/time-slots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          slots: ranges.map((r) => ({
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        }),
      });
    });

    await Promise.all([...datePromises, ...slotPromises]);
  }, [voteSession, dateChoices, votes, currentUserId, getSelectedRanges]);

  const handleConfirm = useCallback(async () => {
    if (!voteSession) return;
    const bestDate = getBestDate(voteSession, votes);
    if (!bestDate) return;

    const confirmActiveDates = voteSession.candidateDates.filter((d) => {
      const v = votes.find((vote) => vote.date === d && vote.choice === "available");
      return !!v;
    });
    // confirm 시에는 서버에 반영된 데이터(allTimeSlots)만 본다 — 다른 멤버 기준으로 best slot을 결정.
    const best = getBestTimeSlot(allTimeSlots, confirmActiveDates);

    await fetch(`/api/groups/${group.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmedDate: bestDate,
        confirmedStartTime: best?.startTime,
        confirmedEndTime: best?.endTime,
      }),
    });
    router.refresh();
  }, [voteSession, votes, allTimeSlots, group.id, router]);

  const bestDate = voteSession ? getBestDate(voteSession, votes) : null;
  const memberIds = group.members.map((m) => m.id);
  const allVoted = voteSession ? isAllVoted(voteSession, votes, memberIds) : false;
  const isHost = group.hostId === currentUserId;
  const confirmed = group.status === "confirmed";
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

  const activeDates = voteSession
    ? voteSession.candidateDates.filter((d) => {
        const choice = dateChoices[d];
        return choice === "available";
      })
    : [];

  // 본인의 로컬 selection을 즉시 timeslot 형태로 합쳐 히트맵·랭킹에 반영한다.
  // 서버 라운드트립을 기다리지 않으므로 자기 화면에서 색이 즉시 칠해진다.
  const effectiveTimeSlots = useMemo<TimeSlot[]>(() => {
    if (!voteSession) return allTimeSlots;
    const others = allTimeSlots.filter((s) => s.userId !== currentUserId);
    const mine: TimeSlot[] = [];
    for (const date of voteSession.candidateDates) {
      const ranges = rangesByDate[date] ?? [];
      ranges.forEach((r, idx) => {
        mine.push({
          id: `local-${date}-${idx}`,
          sessionId: voteSession.id,
          userId: currentUserId,
          date,
          startTime: r.startTime,
          endTime: r.endTime,
        });
      });
    }
    return [...others, ...mine];
  }, [allTimeSlots, rangesByDate, voteSession, currentUserId]);

  const rankedSlots = getRankedTimeSlots(effectiveTimeSlots, activeDates, 2);
  const bestTime = rankedSlots[0] ?? null;
  const hasMyVotes = Object.values(dateChoices).some((c) => c !== null);

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
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
            {group.name}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {group.members.length}명 참여
          </p>
        </div>
        <button
          onClick={handleCopyLink}
          aria-label="초대 링크 복사"
          className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {linkCopied ? (
            <Check size={18} className="text-violet-600 dark:text-violet-400" strokeWidth={2} />
          ) : (
            <Link2 size={18} className="text-gray-600 dark:text-gray-400" strokeWidth={1.5} />
          )}
        </button>
      </div>
      {linkCopied && (
        <div className="mx-5 mt-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-xs text-violet-700 dark:text-violet-300 text-center">
          링크가 복사되었어요!
        </div>
      )}

      {confirmed ? (
        <div className="px-5 mt-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 px-6 py-4">
            <span className="text-2xl">🎉</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                일정이 확정되었어요!
              </p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {bestDate}
                {bestTime && ` ${bestTime.startTime}~${bestTime.endTime}`}
              </p>
            </div>
          </div>
        </div>
      ) : voteSession ? (
        <>
          <WelcomeVoteBanner />
          <div className="px-5 mt-4">
            <DateToggleRow
              dates={voteSession.candidateDates}
              choices={dateChoices}
              onToggle={handleDateToggle}
            />
          </div>

          <BestTimeBanner
            slots={rankedSlots}
            totalMembers={group.members.length}
          />

          <TimeGrid
            dates={voteSession.candidateDates}
            dateChoices={dateChoices}
            isSlotSelected={isSlotSelected}
            pendingStart={pendingStart}
            allTimeSlots={effectiveTimeSlots}
            totalMembers={group.members.length}
            onCellClick={handleTimeSlotClick}
            onDragCommit={commitSweptSlots}
          />

          <CommentSection votes={votes} members={group.members} />

          <VoteActionBar
            hasMyVotes={hasMyVotes}
            isHost={isHost}
            allVoted={allVoted}
            onSaveMyVote={handleMyVoteSave}
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
