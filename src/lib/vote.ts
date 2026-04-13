import type { Vote, VoteSession } from "@/types";

type VoteSummary = Record<
  string,
  { available: number; maybe: number; unavailable: number }
>;

export function getVoteSummary(session: VoteSession, votes: Vote[]): VoteSummary {
  const summary: VoteSummary = {};
  session.candidateDates.forEach((date) => {
    summary[date] = { available: 0, maybe: 0, unavailable: 0 };
  });
  votes.forEach(({ date, choice }) => {
    if (summary[date]) {
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
  let max = -1;
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
