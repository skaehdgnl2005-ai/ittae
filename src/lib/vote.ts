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

type BestTimeResult = {
  date: string;
  startTime: string;
  endTime: string;
  count: number;
};

/**
 * 전체 멤버 슬롯에서 최대 겹침 구간을 찾는다.
 * 가장 많은 인원이 겹치는 연속 구간 중 가장 긴 것을 반환한다.
 */
export function getBestTimeSlot(
  slots: TimeSlot[],
  dates: string[]
): BestTimeResult | null {
  let best: BestTimeResult | null = null;

  for (const date of dates) {
    const heatmap = getTimeSlotHeatmap(slots, date);
    const maxCount = Math.max(...Object.values(heatmap));
    if (maxCount === 0) continue;

    // maxCount인 연속 구간 찾기
    let start: string | null = null;
    for (let i = 0; i <= TIME_SLOTS.length; i++) {
      const t = i < TIME_SLOTS.length ? TIME_SLOTS[i] : null;
      const count = t ? heatmap[t] : 0;

      if (count === maxCount && start === null) {
        start = t!;
      } else if (count !== maxCount && start !== null) {
        // 구간 끝: endTime은 현재 슬롯의 30분 뒤
        const prevSlot = TIME_SLOTS[i - 1];
        const endHour = Math.floor(parseInt(prevSlot.split(":")[0]));
        const endMin = parseInt(prevSlot.split(":")[1]);
        const endTime =
          endMin === 30
            ? `${endHour + 1}:00`
            : `${endHour}:30`;

        if (!best || maxCount > best.count || (maxCount === best.count && start < best.startTime)) {
          best = { date, startTime: start, endTime, count: maxCount };
        }
        start = null;
      }
    }
  }

  return best;
}
