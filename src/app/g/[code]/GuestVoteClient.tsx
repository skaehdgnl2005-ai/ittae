"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { GuestNicknameModal } from "@/components/vote/GuestNicknameModal";
import { BestTimeBanner } from "@/components/vote/BestTimeBanner";
import { TimeGrid } from "@/components/vote/TimeGrid";
import { useTimeSlotSelection } from "@/hooks/useTimeSlotSelection";
import { useGuestRealtime } from "@/hooks/useGuestRealtime";
import { getRankedTimeSlots } from "@/lib/vote";
import {
  getGuestToken,
  setGuestToken,
  setGuestNickname,
  generateBrowserToken,
} from "@/lib/guest";
import { guestFetch } from "@/lib/api/guest";
import type { Vote, VoteChoice, VoteSession, TimeSlot, User, Guest } from "@/types";

type State = {
  group: { id: string; name: string; members: User[]; guests: Guest[] };
  voteSession: VoteSession | null;
  votes: Vote[];
  timeSlots: TimeSlot[];
  currentGuestId: string;
};

type Props = { code: string; groupId: string; groupName: string };

export function GuestVoteClient({ code, groupId, groupName }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [needsNickname, setNeedsNickname] = useState(false);

  // mount: localStorage 토큰 확인 (client-only — SSR hydration 후 1회).
  useEffect(() => {
    const existing = getGuestToken(groupId);
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(existing);
    } else {
      setNeedsNickname(true);
    }
  }, [groupId]);

  // 토큰 있으면 state fetch
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await guestFetch(`/api/invite/${code}/state`, {
        method: "GET",
        token,
      });
      if (res.status === 401) {
        setToken(null);
        setNeedsNickname(true);
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      if (!cancelled) setState(json.data as State);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, code]);

  const handleNicknameSubmit = useCallback(
    async (nickname: string) => {
      const browserToken = generateBrowserToken();
      const res = await fetch(`/api/invite/${code}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, browserToken }),
      });
      if (!res.ok) return;
      setGuestToken(groupId, browserToken);
      setGuestNickname(groupId, nickname);
      setToken(browserToken);
      setNeedsNickname(false);
    },
    [code, groupId]
  );

  if (needsNickname) {
    return <GuestNicknameModal groupName={groupName} onSubmit={handleNicknameSubmit} />;
  }
  if (!state || !token) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-sm text-gray-500">
        로딩 중…
      </div>
    );
  }

  return <GuestVoteInner code={code} token={token} initialState={state} />;
}

function GuestVoteInner({
  code,
  token,
  initialState,
}: {
  code: string;
  token: string;
  initialState: State;
}) {
  const { group, voteSession, currentGuestId } = initialState;

  const { votes, timeSlots: allTimeSlots } = useGuestRealtime(
    code,
    token,
    initialState.votes,
    initialState.timeSlots
  );

  // 모든 후보 날짜는 항상 "available"로 간주 (호스트 화면과 동일한 흐름).
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
    () => initialState.timeSlots.filter((s) => s.guestId === currentGuestId),
    [initialState.timeSlots, currentGuestId]
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

  // 모든 후보 날짜에 대해 votes 자동 등록 (호스트 화면 흐름과 일치).
  // 마운트 시 1회만 — 게스트가 진입했다는 것 자체로 "참여" 시그널.
  const autoVotedRef = useRef(false);
  useEffect(() => {
    if (autoVotedRef.current) return;
    if (!voteSession) return;
    autoVotedRef.current = true;
    for (const date of voteSession.candidateDates) {
      const existing = votes.find(
        (v) => v.guestId === currentGuestId && v.date === date
      );
      if (existing) continue;
      guestFetch(`/api/invite/${code}/votes`, {
        method: "POST",
        token,
        body: JSON.stringify({ date, choice: "available" }),
      });
    }
    // votes는 마운트 시점만 본다 — 의존성에 넣으면 무한 루프.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteSession, code, token, currentGuestId]);

  const lastPersistedNonce = useRef(0);
  useEffect(() => {
    if (!voteSession) return;
    if (pendingPersist.nonce === 0) return;
    if (pendingPersist.nonce === lastPersistedNonce.current) return;
    lastPersistedNonce.current = pendingPersist.nonce;
    for (const date of pendingPersist.dates) {
      const ranges = getSelectedRanges(date);
      guestFetch(`/api/invite/${code}/time-slots`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          date,
          slots: ranges.map((r) => ({
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        }),
      });
    }
  }, [pendingPersist, voteSession, getSelectedRanges, code, token]);

  const totalParticipants = group.members.length + group.guests.length;
  const activeDates = voteSession ? voteSession.candidateDates : [];

  const othersTimeSlots = useMemo<TimeSlot[]>(
    () => allTimeSlots.filter((s) => s.guestId !== currentGuestId),
    [allTimeSlots, currentGuestId]
  );

  const effectiveTimeSlots = useMemo<TimeSlot[]>(() => {
    if (!voteSession) return othersTimeSlots;
    const mine: TimeSlot[] = [];
    for (const date of voteSession.candidateDates) {
      const ranges = rangesByDate[date] ?? [];
      ranges.forEach((r, idx) => {
        mine.push({
          id: `local-${date}-${idx}`,
          sessionId: voteSession.id,
          userId: null,
          guestId: currentGuestId,
          date,
          startTime: r.startTime,
          endTime: r.endTime,
        });
      });
    }
    return [...othersTimeSlots, ...mine];
  }, [othersTimeSlots, rangesByDate, voteSession, currentGuestId]);

  const rankedSlots = getRankedTimeSlots(effectiveTimeSlots, activeDates, 2);
  const othersTotal = Math.max(0, totalParticipants - 1);

  return (
    <div className="bg-gray-50 min-h-dvh pb-[40px] dark:bg-gray-950">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <Link
          href={ROUTES.HOME}
          aria-label="홈으로"
          className="min-h-11 min-w-11 flex items-center justify-center -ml-2"
        >
          <ChevronLeft size={24} className="text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
            {group.name}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {totalParticipants}명 참여 · 게스트로 투표 중
          </p>
        </div>
      </div>

      {voteSession ? (
        <>
          <BestTimeBanner slots={rankedSlots} totalMembers={totalParticipants} />

          <TimeGrid
            dates={voteSession.candidateDates}
            dateChoices={dateChoices}
            isSlotSelected={isSlotSelected}
            pendingStart={pendingStart}
            othersTimeSlots={othersTimeSlots}
            othersTotal={othersTotal}
            onCellClick={(d, t) => handleCellClick(d, t)}
            onDragCommit={commitSweptSlots}
          />
        </>
      ) : (
        <p className="px-5 mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          투표 세션이 없어요.
        </p>
      )}
    </div>
  );
}
