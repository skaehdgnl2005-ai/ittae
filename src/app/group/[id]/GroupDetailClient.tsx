"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BestTimeBanner } from "@/components/vote/BestTimeBanner";
import { TimeGrid } from "@/components/vote/TimeGrid";
import { VoteActionBar } from "@/components/vote/VoteActionBar";
import { ConfirmActionBar } from "@/components/vote/ConfirmActionBar";
import { WelcomeVoteBanner } from "@/components/vote/WelcomeVoteBanner";
import { CommentSection } from "@/components/vote/CommentSection";
import { useVoteRealtime } from "@/hooks/useVoteRealtime";
import { useTimeSlotSelection } from "@/hooks/useTimeSlotSelection";
import { getRankedTimeSlots, isAllVoted, type BestTimeResult } from "@/lib/vote";
import type { Vote, VoteChoice, VoteSession, Group, TimeSlot } from "@/types";
import { ChevronLeft, Link2, Check } from "lucide-react";

type Props = {
  group: Group;
  voteSession: VoteSession | null;
  initialVotes: Vote[];
  initialTimeSlots?: TimeSlot[];
  currentUserId: string;
};

function rangeLengthMin(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
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
  const voteHook = useTimeSlotSelection(myInitialSlots);
  // 확정 모드에서 방장이 선택한 시간 슬롯 — voteHook과 별개로 관리한다.
  const confirmHook = useTimeSlotSelection([]);

  const [mode, setMode] = useState<"vote" | "confirm">("vote");

  // 사용자가 시간 슬롯을 직접 변경했을 때만 (마운트 시점 PUT 발사 X) 서버에 저장.
  // pendingPersist.nonce는 사용자 액션이 있을 때만 증가한다.
  const lastPersistedNonce = useRef(0);
  useEffect(() => {
    if (!voteSession) return;
    if (voteHook.pendingPersist.nonce === 0) return;
    if (voteHook.pendingPersist.nonce === lastPersistedNonce.current) return;
    lastPersistedNonce.current = voteHook.pendingPersist.nonce;

    const sessionId = voteSession.id;
    for (const date of voteHook.pendingPersist.dates) {
      const ranges = voteHook.getSelectedRanges(date);
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
  }, [voteHook.pendingPersist, voteHook.getSelectedRanges, voteSession, voteHook]);

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
      const ranges = voteHook.getSelectedRanges(date);
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
  }, [voteSession, votes, currentUserId, voteHook]);

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

  const activeDates = useMemo(
    () => (voteSession ? voteSession.candidateDates : []),
    [voteSession]
  );

  // 다른 사람들 timeSlots만 — 히트맵 색 계산용 (본인은 본인 색으로 별도 표시).
  const othersTimeSlots = useMemo<TimeSlot[]>(
    () => allTimeSlots.filter((s) => s.userId !== currentUserId),
    [allTimeSlots, currentUserId]
  );

  // 본인의 로컬 selection까지 합친 슬롯 — 1·2·3순위 시간 랭킹 계산용 (본인 가용성도 반영).
  const effectiveTimeSlots = useMemo<TimeSlot[]>(() => {
    if (!voteSession) return othersTimeSlots;
    const mine: TimeSlot[] = [];
    for (const date of voteSession.candidateDates) {
      const ranges = voteHook.rangesByDate[date] ?? [];
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
  }, [othersTimeSlots, voteHook.rangesByDate, voteSession, currentUserId]);

  const rankedSlots = getRankedTimeSlots(effectiveTimeSlots, activeDates, 3);
  const bestTime = rankedSlots[0] ?? null;
  const hasMyVotes = Object.values(voteHook.rangesByDate).some(
    (ranges) => ranges.length > 0
  );
  const hasSavedBefore = useMemo(
    () => votes.some((v) => v.userId === currentUserId),
    [votes, currentUserId]
  );
  const totalParticipants = group.members.length + group.guests.length;
  const othersTotal = Math.max(0, totalParticipants - 1);

  // 확정 모드: 방장이 선택한 시간 — confirm hook의 가장 긴 range를 채택한다.
  const pickedSlot = useMemo<BestTimeResult | null>(() => {
    if (mode !== "confirm") return null;
    let best: BestTimeResult | null = null;
    let bestLen = 0;
    for (const date of activeDates) {
      const ranges = confirmHook.rangesByDate[date] ?? [];
      for (const r of ranges) {
        const len = rangeLengthMin(r.startTime, r.endTime);
        if (len > bestLen) {
          bestLen = len;
          best = {
            date,
            startTime: r.startTime,
            endTime: r.endTime,
            count: 0,
          };
        }
      }
    }
    return best;
  }, [mode, confirmHook.rangesByDate, activeDates]);

  const handleEnterConfirm = useCallback(() => {
    confirmHook.resetFromSlots([]);
    setMode("confirm");
  }, [confirmHook]);

  const handleCancelConfirm = useCallback(() => {
    confirmHook.resetFromSlots([]);
    setMode("vote");
  }, [confirmHook]);

  const handlePickRank = useCallback(
    (slot: BestTimeResult) => {
      if (!voteSession) return;
      confirmHook.resetFromSlots([
        {
          id: `confirm-pick-${slot.date}`,
          sessionId: voteSession.id,
          userId: currentUserId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      ]);
    },
    [confirmHook, voteSession, currentUserId]
  );

  const handleConfirmFinalize = useCallback(async () => {
    if (!voteSession || !pickedSlot) return;
    await fetch(`/api/groups/${group.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmedDate: pickedSlot.date,
        confirmedStartTime: pickedSlot.startTime,
        confirmedEndTime: pickedSlot.endTime,
      }),
    });
    router.refresh();
  }, [voteSession, pickedSlot, group.id, router]);

  // 확정 화면 표시용 — 확정된 날짜는 group.confirmedDate 우선, 없으면 합의 best.
  const confirmedDateDisplay =
    group.confirmedDate ?? bestTime?.date ?? voteSession?.candidateDates[0] ?? null;

  // TimeGrid에 넘길 활성 hook (vote vs confirm)
  const activeHook = mode === "vote" ? voteHook : confirmHook;
  // 확정 모드에서는 전원 가용 인원을 히트맵 배경으로 보여준다.
  const heatmapSource = mode === "confirm" ? effectiveTimeSlots : othersTimeSlots;
  const heatmapTotal = mode === "confirm" ? totalParticipants : othersTotal;

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
          {mode === "confirm" ? (
            <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs text-center dark:bg-gray-100 dark:text-gray-900">
              순위에서 고르거나 시간표에서 직접 선택해 주세요
            </div>
          ) : (
            <WelcomeVoteBanner />
          )}

          <BestTimeBanner
            slots={rankedSlots}
            totalMembers={totalParticipants}
            onPickRank={mode === "confirm" ? handlePickRank : undefined}
            selectedSlot={mode === "confirm" ? pickedSlot : null}
          />

          <TimeGrid
            dates={voteSession.candidateDates}
            dateChoices={dateChoices}
            isSlotSelected={activeHook.isSlotSelected}
            pendingStart={activeHook.pendingStart}
            othersTimeSlots={heatmapSource}
            othersTotal={heatmapTotal}
            onCellClick={activeHook.handleCellClick}
            onDragCommit={activeHook.commitSweptSlots}
          />

          {mode === "vote" && (
            <CommentSection votes={votes} members={group.members} />
          )}

          {mode === "vote" ? (
            <VoteActionBar
              hasMyVotes={hasMyVotes}
              hasSavedBefore={hasSavedBefore}
              isHost={isHost}
              allVoted={allVoted}
              onSaveMyVote={handleMyVoteSave}
              onConfirm={handleEnterConfirm}
            />
          ) : (
            <ConfirmActionBar
              pickedSlot={pickedSlot}
              onCancel={handleCancelConfirm}
              onConfirm={handleConfirmFinalize}
            />
          )}
        </>
      ) : (
        <p className="px-5 mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          투표 세션이 없습니다.
        </p>
      )}
    </div>
  );
}
