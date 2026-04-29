import type { Vote, VoteSession, TimeSlot } from "@/types";

/** 12:00–19:30, 30분 간격, 16개 슬롯 */
export const TIME_SLOTS: string[] = Array.from({ length: 16 }, (_, i) => {
  const hour = 12 + Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  return `${hour}:${min}`;
});

type VoteSummary = Record<string, { available: number; unavailable: number }>;

export function getVoteSummary(
  session: VoteSession,
  votes: Vote[]
): VoteSummary {
  const summary: VoteSummary = {};
  session.candidateDates.forEach((date) => {
    summary[date] = { available: 0, unavailable: 0 };
  });
  votes.forEach(({ date, choice }) => {
    if (summary[date] && (choice === "available" || choice === "unavailable")) {
      summary[date][choice]++;
    }
  });
  return summary;
}

export function getBestDate(
  session: VoteSession,
  votes: Vote[]
): string | null {
  const summary = getVoteSummary(session, votes);
  let best: string | null = null;
  let max = 0;
  session.candidateDates.forEach((date) => {
    if (summary[date].available > max) {
      max = summary[date].available;
      best = date;
    }
  });
  return best;
}

export function isAllVoted(
  session: VoteSession,
  votes: Vote[],
  memberIds: string[]
): boolean {
  return memberIds.every((userId) =>
    session.candidateDates.every((date) =>
      votes.some((v) => v.userId === userId && v.date === date)
    )
  );
}

/**
 * 특정 날짜의 슬롯별 가용 인원 수를 집계한다.
 * 키: "HH:MM" (TIME_SLOTS 각 항목), 값: 해당 슬롯을 포함하는 유저 수.
 * startTime 이상, endTime 미만의 슬롯을 "포함"으로 판단한다.
 */
export function getTimeSlotHeatmap(
  slots: TimeSlot[],
  date: string
): Record<string, number> {
  const heatmap: Record<string, number> = {};
  TIME_SLOTS.forEach((t) => {
    heatmap[t] = 0;
  });

  const dateSlots = slots.filter((s) => s.date === date);
  for (const slot of dateSlots) {
    for (const t of TIME_SLOTS) {
      if (t >= slot.startTime && t < slot.endTime) {
        heatmap[t]++;
      }
    }
  }

  return heatmap;
}

export type BestTimeResult = {
  date: string;
  startTime: string;
  endTime: string;
  count: number;
};

function slotMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function endTimeOf(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  return m === 30 ? `${h + 1}:00` : `${h}:30`;
}

/**
 * 한 날짜의 heatmap을 같은 count가 연속되는 세그먼트로 분리한다.
 * count === 0인 구간은 후보에서 제외한다.
 */
function getDateSegments(
  slots: TimeSlot[],
  date: string
): BestTimeResult[] {
  const heatmap = getTimeSlotHeatmap(slots, date);
  const segments: BestTimeResult[] = [];

  let segStartIdx: number | null = null;
  let segCount = 0;

  for (let i = 0; i <= TIME_SLOTS.length; i++) {
    const t = i < TIME_SLOTS.length ? TIME_SLOTS[i] : null;
    const c = t ? heatmap[t] : -1;

    if (c !== segCount) {
      if (segStartIdx !== null && segCount > 0) {
        segments.push({
          date,
          startTime: TIME_SLOTS[segStartIdx],
          endTime: endTimeOf(TIME_SLOTS[i - 1]),
          count: segCount,
        });
      }
      segStartIdx = t ? i : null;
      segCount = c;
    }
  }

  return segments;
}

/**
 * 전체 멤버 슬롯에서 인원이 많이 겹치는 후보 구간을 순위순으로 반환한다.
 * 정렬 기준: count 내림차순 → 길이 내림차순 → 날짜 오름차순 → 시작시간 오름차순.
 * 단, 2순위 이후로는 같은 count의 다른 날짜 후보가 있으면 우선 선택해 다양성을 확보한다.
 */
export function getRankedTimeSlots(
  slots: TimeSlot[],
  dates: string[],
  topN = 2
): BestTimeResult[] {
  const candidates: BestTimeResult[] = [];
  for (const date of dates) {
    candidates.push(...getDateSegments(slots, date));
  }

  candidates.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const aLen = slotMinutes(a.endTime) - slotMinutes(a.startTime);
    const bLen = slotMinutes(b.endTime) - slotMinutes(b.startTime);
    if (bLen !== aLen) return bLen - aLen;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return slotMinutes(a.startTime) - slotMinutes(b.startTime);
  });

  const picked: BestTimeResult[] = [];
  const usedDates = new Set<string>();
  const remaining = [...candidates];

  while (picked.length < topN && remaining.length > 0) {
    let idx = 0;
    if (picked.length > 0) {
      const topCount = remaining[0].count;
      const diffDateIdx = remaining.findIndex(
        (c) => !usedDates.has(c.date) && c.count === topCount
      );
      if (diffDateIdx >= 0) idx = diffDateIdx;
    }
    const chosen = remaining.splice(idx, 1)[0];
    picked.push(chosen);
    usedDates.add(chosen.date);
  }

  return picked;
}

/**
 * 전체 멤버 슬롯에서 최대 겹침 구간을 찾는다.
 * 가장 많은 인원이 겹치는 연속 구간 중 가장 긴 것을 반환한다.
 */
export function getBestTimeSlot(
  slots: TimeSlot[],
  dates: string[]
): BestTimeResult | null {
  return getRankedTimeSlots(slots, dates, 1)[0] ?? null;
}
