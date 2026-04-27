"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DateToggleRow } from "@/components/vote/DateToggleRow";
import { BestTimeBanner } from "@/components/vote/BestTimeBanner";
import { TimeGrid } from "@/components/vote/TimeGrid";
import { StickyConfirmButton } from "@/components/vote/StickyConfirmButton";
import { CommentSection } from "@/components/vote/CommentSection";
import { useVoteRealtime } from "@/hooks/useVoteRealtime";
import { useTimeSlotSelection } from "@/hooks/useTimeSlotSelection";
import { getBestDate, getBestTimeSlot, isAllVoted } from "@/lib/vote";
import { mockUsers, mockCurrentUserId } from "@/lib/mock";
import type { Vote, VoteChoice, VoteSession, Group, User, TimeSlot } from "@/types";
import { ChevronLeft, Link2, Check } from "lucide-react";

type MockNewData = {
  name: string;
  memberIds: string[];
  candidateDates: string[];
  deadline: string | null;
};

function readMockNewData(): MockNewData | null {
  try {
    const raw = sessionStorage.getItem("mock-new-group");
    if (!raw) return null;
    return JSON.parse(raw) as MockNewData;
  } catch {
    return null;
  }
}

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
  group: defaultGroup,
  voteSession: defaultSession,
  initialVotes: defaultVotes,
  initialTimeSlots: defaultTimeSlots = [],
  currentUserId,
}: Props) {
  const router = useRouter();
  const isMock = defaultGroup.id.startsWith("mock-");

  // mock-new: sessionStorage에서 사용자 입력 데이터로 오버라이드
  const [{ group, voteSession, initialVotes, initialTimeSlots }] = useState(() => {
    if (defaultGroup.id !== "mock-new") {
      return {
        group: defaultGroup,
        voteSession: defaultSession,
        initialVotes: defaultVotes,
        initialTimeSlots: defaultTimeSlots,
      };
    }
    const saved = readMockNewData();
    if (!saved) {
      return {
        group: defaultGroup,
        voteSession: defaultSession,
        initialVotes: defaultVotes,
        initialTimeSlots: defaultTimeSlots,
      };
    }

    const allMock = mockUsers;
    const me = allMock.find((u) => u.id === mockCurrentUserId);
    const selectedMembers: User[] = saved.memberIds
      .map((id) => allMock.find((u) => u.id === id))
      .filter((u): u is User => u !== undefined);
    if (me && !selectedMembers.some((m) => m.id === me.id)) {
      selectedMembers.unshift(me);
    }

    const newGroup: Group = {
      ...defaultGroup,
      name: saved.name,
      members: selectedMembers.length > 0 ? selectedMembers : defaultGroup.members,
    };

    const newSession: VoteSession = {
      id: "vs-new",
      groupId: "mock-new",
      candidateDates: saved.candidateDates,
      deadline: saved.deadline ?? "",
    };

    return { group: newGroup, voteSession: newSession, initialVotes: [] as Vote[], initialTimeSlots: [] as TimeSlot[] };
  });

  // Realtime (production)
  const { votes: realtimeVotes, timeSlots: realtimeTimeSlots } = useVoteRealtime(
    voteSession?.id ?? "",
    initialVotes,
    initialTimeSlots
  );

  // Mock 로컬 상태
  const [localVotes, setLocalVotes] = useState<Vote[]>(initialVotes);
  const [localTimeSlots, setLocalTimeSlots] = useState<TimeSlot[]>(
    initialTimeSlots
  );
  const [confirmed, setConfirmed] = useState(group.status === "confirmed");

  const votes = isMock ? localVotes : realtimeVotes;
  const allTimeSlots = isMock ? localTimeSlots : realtimeTimeSlots;

  // 날짜 O/X 선택 상태: 현재 유저의 vote에서 파생
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

  // 시간 슬롯 선택 (현재 유저의 것만)
  const myInitialSlots = (isMock ? localTimeSlots : initialTimeSlots).filter(
    (s) => s.userId === currentUserId
  );
  const {
    state: selectionState,
    pendingStart,
    handleCellClick,
    commitSweptSlots,
    isSlotSelected,
    getSelectedRanges,
  } = useTimeSlotSelection(myInitialSlots);

  // 날짜 토글 핸들러
  const handleDateToggle = useCallback(
    async (date: string) => {
      const current = dateChoices[date] ?? null;
      const next = cycleDateChoice(current);

      setDateChoices((prev) => ({ ...prev, [date]: next }));

      if (!voteSession) return;

      if (isMock) {
        if (next === null) {
          // 미선택: 투표 제거
          setLocalVotes((prev) =>
            prev.filter((v) => !(v.userId === currentUserId && v.date === date))
          );
        } else {
          setLocalVotes((prev) => {
            const idx = prev.findIndex(
              (v) => v.userId === currentUserId && v.date === date
            );
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], choice: next };
              return updated;
            }
            return [
              ...prev,
              {
                id: `local-${Date.now()}`,
                sessionId: voteSession.id,
                userId: currentUserId,
                date,
                choice: next,
                comment: null,
              },
            ];
          });
        }
        return;
      }

      // Production
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
    [dateChoices, voteSession, isMock, currentUserId, votes]
  );

  // 시간 슬롯 저장: 셀 클릭 후 rangeComplete로 돌아올 때마다 서버 동기화
  const handleTimeSlotClick = useCallback(
    (date: string, time: string) => {
      handleCellClick(date, time);
    },
    [handleCellClick]
  );

  // selectionState가 idle로 돌아오면 (range 완성 or 해제 후) 서버에 저장
  useEffect(() => {
    if (selectionState !== "idle" || !voteSession) return;

    if (isMock) {
      // Mock: 로컬 time slots 갱신
      const dates = voteSession.candidateDates;
      const newSlots: TimeSlot[] = [];
      for (const date of dates) {
        const ranges = getSelectedRanges(date);
        for (const range of ranges) {
          newSlots.push({
            id: `local-ts-${date}-${range.startTime}`,
            sessionId: voteSession.id,
            userId: currentUserId,
            date,
            startTime: range.startTime,
            endTime: range.endTime,
          });
        }
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mock 로컬 상태 동기화
      setLocalTimeSlots((prev) => [
        ...prev.filter((s) => s.userId !== currentUserId),
        ...newSlots,
      ]);
      return;
    }

    // Production: PUT per changed date
    // (Simplified — save all dates)
    const dates = voteSession.candidateDates;
    for (const date of dates) {
      const ranges = getSelectedRanges(date);
      fetch(`/api/vote-sessions/${voteSession.id}/time-slots`, {
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
  }, [selectionState, voteSession, isMock, currentUserId, getSelectedRanges]);

  // 확정 핸들러
  const handleConfirm = useCallback(async () => {
    if (!voteSession) return;
    const bestDate = getBestDate(voteSession, votes);
    if (!bestDate) return;

    const activeDates = voteSession.candidateDates.filter(
      (d) => {
        const v = votes.find((vote) => vote.date === d && vote.choice === "available");
        return !!v;
      }
    );
    const best = getBestTimeSlot(allTimeSlots, activeDates);

    if (isMock) {
      setConfirmed(true);
      return;
    }

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
  }, [voteSession, votes, allTimeSlots, isMock, group.id, router]);

  // 파생 상태
  const bestDate = voteSession ? getBestDate(voteSession, votes) : null;
  const memberIds = group.members.map((m) => m.id);
  const allVoted = voteSession ? isAllVoted(voteSession, votes, memberIds) : false;
  const isHost = group.hostId === currentUserId;
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
  const bestTime = getBestTimeSlot(allTimeSlots, activeDates);

  // 히트맵 표시: 전원 투표 완료 시
  const showHeatmap = allVoted && allTimeSlots.length > 0;

  return (
    <div className="bg-gray-50 min-h-dvh pb-[140px] dark:bg-gray-950">
      {/* 헤더 */}
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
          {/* 날짜 선택 행 */}
          <div className="px-5 mt-4">
            <DateToggleRow
              dates={voteSession.candidateDates}
              choices={dateChoices}
              onToggle={handleDateToggle}
            />
          </div>

          {/* 최적 시간대 배너 */}
          <BestTimeBanner
            date={bestTime?.date ?? null}
            startTime={bestTime?.startTime ?? null}
            endTime={bestTime?.endTime ?? null}
            count={bestTime?.count ?? 0}
            totalMembers={group.members.length}
          />

          {/* 시간 그리드 */}
          <TimeGrid
            dates={voteSession.candidateDates}
            dateChoices={dateChoices}
            isSlotSelected={isSlotSelected}
            pendingStart={pendingStart}
            allTimeSlots={allTimeSlots}
            totalMembers={group.members.length}
            showHeatmap={showHeatmap}
            onCellClick={handleTimeSlotClick}
            onDragCommit={commitSweptSlots}
          />

          {/* 코멘트 */}
          <CommentSection votes={votes} members={group.members} />

          {/* 확정 버튼 */}
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
