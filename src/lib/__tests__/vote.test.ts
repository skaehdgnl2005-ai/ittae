import { describe, it, expect } from "vitest";
import { getBestDate, getVoteSummary, isAllVoted } from "@/lib/vote";
import type { Vote, VoteSession } from "@/types";

const session: VoteSession = {
  id: "vs1",
  groupId: "g1",
  candidateDates: ["2026-04-25", "2026-04-26", "2026-04-27"],
  deadline: "2026-04-20",
};

const votes: Vote[] = [
  {
    id: "v1",
    sessionId: "vs1",
    userId: "u1",
    date: "2026-04-25",
    choice: "available",
    comment: null,
  },
  {
    id: "v2",
    sessionId: "vs1",
    userId: "u1",
    date: "2026-04-26",
    choice: "maybe",
    comment: null,
  },
  {
    id: "v3",
    sessionId: "vs1",
    userId: "u1",
    date: "2026-04-27",
    choice: "unavailable",
    comment: null,
  },
  {
    id: "v4",
    sessionId: "vs1",
    userId: "u2",
    date: "2026-04-25",
    choice: "available",
    comment: null,
  },
  {
    id: "v5",
    sessionId: "vs1",
    userId: "u2",
    date: "2026-04-26",
    choice: "available",
    comment: null,
  },
  {
    id: "v6",
    sessionId: "vs1",
    userId: "u2",
    date: "2026-04-27",
    choice: "maybe",
    comment: null,
  },
];

const memberIds = ["u1", "u2", "u3"];

describe("getBestDate", () => {
  it("available 투표가 가장 많은 날짜를 반환한다", () => {
    expect(getBestDate(session, votes)).toBe("2026-04-25");
  });
});

describe("getVoteSummary", () => {
  it("날짜별 available/maybe/unavailable 수를 반환한다", () => {
    const summary = getVoteSummary(session, votes);
    expect(summary["2026-04-25"]).toEqual({
      available: 2,
      maybe: 0,
      unavailable: 0,
    });
    expect(summary["2026-04-26"]).toEqual({
      available: 1,
      maybe: 1,
      unavailable: 0,
    });
  });
});

describe("isAllVoted", () => {
  it("모든 멤버가 투표했으면 true", () => {
    expect(isAllVoted(session, votes, ["u1", "u2"])).toBe(true);
  });
  it("투표 안 한 멤버가 있으면 false", () => {
    expect(isAllVoted(session, votes, memberIds)).toBe(false);
  });
});
