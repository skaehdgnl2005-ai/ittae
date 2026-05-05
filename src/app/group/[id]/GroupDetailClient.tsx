"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BestTimeBanner } from "@/components/vote/BestTimeBanner";
import { TimeGrid } from "@/components/vote/TimeGrid";
import { VoteActionBar } from "@/components/vote/VoteActionBar";
import { WelcomeVoteBanner } from "@/components/vote/WelcomeVoteBanner";
import { CommentSection } from "@/components/vote/CommentSection";
import { useVoteRealtime } from "@/hooks/useVoteRealtime";
import { useTimeSlotSelection } from "@/hooks/useTimeSlotSelection";
import { getBestTimeSlot, getRankedTimeSlots, isAllVoted } from "@/lib/vote";
import type { Vote, VoteChoice, VoteSession, Group, TimeSlot } from "@/types";
import { ChevronLeft, Link2, Check } from "lucide-react";

type Props = {
  group: Group;
  voteSession: VoteSession | null;
  initialVotes: Vote[];
  initialTimeSlots?: TimeSlot[];
  currentUserId: string;
};

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

  // 날짜 가능/불가 토글은 제거됨 — 모든 후보 날짜는 항상 "가능"으로 처리한다.
  // 시간 그리드의 disabled 분기 호환을 위해 dateChoices만 유지.
  const dateChoices = useMemo<Record<string, VoteChoice | null>>(() => {
    const map: Record<string, VoteChoice | null> = {};
    if (voteSession) {
      voteSession.candidateDates.forEach((d) => {
        map[d] = "available";
      });
    }
    return map;
  }, [voteSession]);

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

    // 모든 후보 날짜를 자동으로 "available" 로 마킹한다 (저장 시 1회).
    // isAllVoted/getBestDate 등 기존 로직과 호환을 유지하려는 목적.
    const datePromises = voteSession.candidateDates.map((date) => {
      const existing = votes.find(
        (v) => v.userId === currentUserId && v.date === date
      );
      const method = existing ? "PATCH" : "POST";
      return fetch(`/api/vote-sessions/${voteSession.id}/votes`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, choice: "available" }),
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
  }, [voteSession, votes, currentUserId, getSelectedRanges]);

  const handleConfirm = useCallback(async () => {
    if (!voteSession) return;

    // 날짜별 가용 토글이 사라졌으므로, 시간 슬롯 합의에서 best 날짜+시간을 함께 결정한다.
    const best = getBestTimeSlot(allTimeSlots, voteSession.candidateDates);
    const confirmedDate = best?.date ?? voteSession.candidateDates[0];
    if (!confirmedDate) return;

    await fetch(`/api/groups/${group.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmedDate,
        confirmedStartTime: best?.startTime,
        confirmedEndTime: best?.endTime,
      }),
    });
    router.refresh();
  }, [voteSession, allTimeSlots, group.id, router]);

  const memberIds = group.members.map((m) => m.id);
  const allVoted = voteSession ? isAllVoted(voteSession, votes, memberIds) : false;
  const isHost = group.hostId === currentUserId;
  const confirmed = group.status === "confirmed";
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    const target = group.inviteCode
      ? `${window.location.origin}/g/${group.inviteCode}`
      : window.location.href;
    await navigator.clipboard.writeText(target);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [group.inviteCode]);

  const activeDates = voteSession ? voteSession.candidateDates : [];

  // 다른 사람들 timeSlots만 — 히트맵 색 계산용 (본인은 본인 색으로 별도 표시).
  const othersTimeSlots = useMemo<TimeSlot[]>(
    () => allTimeSlots.filter((s) => s.userId !== currentUserId),
    [allTimeSlots, currentUserId]
  );

  // 본인의 로컬 selection까지 합친 슬롯 — 1·2순위 시간 랭킹 계산용 (본인 가용성도 반영).
  const effectiveTimeSlots = useMemo<TimeSlot[]>(() => {
    if (!voteSession) return othersTimeSlots;
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
    return [...othersTimeSlots, ...mine];
  }, [othersTimeSlots, rangesByDate, voteSession, currentUserId]);

  const rankedSlots = getRankedTimeSlots(effectiveTimeSlots, activeDates, 2);
  const bestTime = rankedSlots[0] ?? null;
  const hasMyVotes = Object.values(rangesByDate).some(
    (ranges) => ranges.length > 0
  );
  const totalParticipants = group.members.length + group.guests.length;
  const othersTotal = Math.max(0, totalParticipants - 1);

  // 확정 화면 표시용 — 확정된 날짜는 group.confirmedDate 우선, 없으면 합의 best.
  const confirmedDateDisplay =
    group.confirmedDate ?? bestTime?.date ?? voteSession?.candidateDates[0] ?? null;

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
            {totalParticipants}명 참여
            {group.guests.length > 0 && ` · 게스트 ${group.guests.length}`}
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
                {confirmedDateDisplay}
                {bestTime && ` ${bestTime.startTime}~${bestTime.endTime}`}
              </p>
            </div>
          </div>
        </div>
      ) : voteSession ? (
        <>
          <WelcomeVoteBanner />

          <BestTimeBanner
            slots={rankedSlots}
            totalMembers={totalParticipants}
          />

          <TimeGrid
            dates={voteSession.candidateDates}
            dateChoices={dateChoices}
            isSlotSelected={isSlotSelected}
            pendingStart={pendingStart}
            othersTimeSlots={othersTimeSlots}
            othersTotal={othersTotal}
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
