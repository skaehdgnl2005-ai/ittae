import { describe, it, expect } from "vitest";
import {
  getBestTimeSlot,
  getRankedTimeSlots,
  getTimeSlotHeatmap,
  TIME_SLOTS,
  getVoteSummary,
} from "@/lib/vote";
import type { VoteSession, Vote, TimeSlot } from "@/types";

const session: VoteSession = {
  id: "vs1",
  groupId: "g1",
  candidateDates: ["2026-04-25", "2026-04-26"],
  deadline: "",
};

describe("TIME_SLOTS", () => {
  it("has 16 slots from 12:00 to 19:30", () => {
    expect(TIME_SLOTS).toHaveLength(16);
    expect(TIME_SLOTS[0]).toBe("12:00");
    expect(TIME_SLOTS[15]).toBe("19:30");
  });
});

describe("getVoteSummary (no maybe)", () => {
  it("counts only available and unavailable", () => {
    const votes: Vote[] = [
      { id: "v1", sessionId: "vs1", userId: "u1", date: "2026-04-25", choice: "available", comment: null },
      { id: "v2", sessionId: "vs1", userId: "u2", date: "2026-04-25", choice: "unavailable", comment: null },
    ];
    const result = getVoteSummary(session, votes);
    expect(result["2026-04-25"]).toEqual({ available: 1, unavailable: 1 });
  });
});

describe("getTimeSlotHeatmap", () => {
  it("counts overlapping users per slot", () => {
    const slots: TimeSlot[] = [
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "16:00" },
      { id: "t2", sessionId: "vs1", userId: "u2", date: "2026-04-25", startTime: "15:00", endTime: "17:00" },
    ];
    const heatmap = getTimeSlotHeatmap(slots, "2026-04-25");
    // 14:00 — only u1
    expect(heatmap["14:00"]).toBe(1);
    expect(heatmap["14:30"]).toBe(1);
    // 15:00, 15:30 — both u1 and u2
    expect(heatmap["15:00"]).toBe(2);
    expect(heatmap["15:30"]).toBe(2);
    // 16:00, 16:30 — only u2
    expect(heatmap["16:00"]).toBe(1);
    expect(heatmap["16:30"]).toBe(1);
    // 17:00 — nobody (endTime is exclusive)
    expect(heatmap["17:00"]).toBe(0);
  });

  it("returns all zeros for empty slots", () => {
    const heatmap = getTimeSlotHeatmap([], "2026-04-25");
    expect(heatmap["12:00"]).toBe(0);
    expect(heatmap["19:30"]).toBe(0);
  });
});

describe("getBestTimeSlot", () => {
  it("finds the time range with maximum overlap across all dates", () => {
    const slots: TimeSlot[] = [
      // u1: 14:00–17:00 on 4/25
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "17:00" },
      // u2: 14:00–17:00 on 4/25
      { id: "t2", sessionId: "vs1", userId: "u2", date: "2026-04-25", startTime: "14:00", endTime: "17:00" },
      // u3: 15:00–17:00 on 4/25
      { id: "t3", sessionId: "vs1", userId: "u3", date: "2026-04-25", startTime: "15:00", endTime: "17:00" },
      // u1: 13:00–14:00 on 4/26
      { id: "t4", sessionId: "vs1", userId: "u1", date: "2026-04-26", startTime: "13:00", endTime: "14:00" },
    ];
    const result = getBestTimeSlot(slots, ["2026-04-25", "2026-04-26"]);
    expect(result).not.toBeNull();
    expect(result!.date).toBe("2026-04-25");
    // Best overlap is 3 people at 15:00-17:00
    expect(result!.count).toBe(3);
    expect(result!.startTime).toBe("15:00");
    expect(result!.endTime).toBe("17:00");
  });

  it("returns null when no slots exist", () => {
    const result = getBestTimeSlot([], ["2026-04-25"]);
    expect(result).toBeNull();
  });
});

describe("getRankedTimeSlots", () => {
  it("returns top 2 ranked time slots across multiple dates", () => {
    const slots: TimeSlot[] = [
      // 4/25: 3명 겹침 15:00-17:00
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "17:00" },
      { id: "t2", sessionId: "vs1", userId: "u2", date: "2026-04-25", startTime: "14:00", endTime: "17:00" },
      { id: "t3", sessionId: "vs1", userId: "u3", date: "2026-04-25", startTime: "15:00", endTime: "17:00" },
      // 4/26: 2명 겹침 18:00-19:00
      { id: "t4", sessionId: "vs1", userId: "u1", date: "2026-04-26", startTime: "18:00", endTime: "19:00" },
      { id: "t5", sessionId: "vs1", userId: "u2", date: "2026-04-26", startTime: "18:00", endTime: "19:00" },
    ];
    const result = getRankedTimeSlots(slots, ["2026-04-25", "2026-04-26"], 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: "2026-04-25",
      startTime: "15:00",
      endTime: "17:00",
      count: 3,
    });
    expect(result[1]).toEqual({
      date: "2026-04-26",
      startTime: "18:00",
      endTime: "19:00",
      count: 2,
    });
  });

  it("returns 2nd-rank candidate within the same date when only one date is active", () => {
    const slots: TimeSlot[] = [
      // 12:00-13:00: 2명, 14:00-15:00: 1명, 16:00-17:00: 2명
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "12:00", endTime: "13:00" },
      { id: "t2", sessionId: "vs1", userId: "u2", date: "2026-04-25", startTime: "12:00", endTime: "13:00" },
      { id: "t3", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "15:00" },
      { id: "t4", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "16:00", endTime: "17:00" },
      { id: "t5", sessionId: "vs1", userId: "u2", date: "2026-04-25", startTime: "16:00", endTime: "17:00" },
    ];
    const result = getRankedTimeSlots(slots, ["2026-04-25"], 2);
    expect(result).toHaveLength(2);
    // 두 후보 모두 2명 1시간 — date+startTime 빠른 쪽이 1순위
    expect(result[0].count).toBe(2);
    expect(result[0].startTime).toBe("12:00");
    expect(result[1].count).toBe(2);
    expect(result[1].startTime).toBe("16:00");
  });

  it("returns fewer than topN when candidates are scarce", () => {
    const slots: TimeSlot[] = [
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "15:00" },
    ];
    const result = getRankedTimeSlots(slots, ["2026-04-25", "2026-04-26"], 2);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
  });

  it("returns empty array when no slots exist", () => {
    expect(getRankedTimeSlots([], ["2026-04-25"], 2)).toEqual([]);
  });

  it("prefers longer range when count is tied", () => {
    const slots: TimeSlot[] = [
      // 4/25: 2명 겹침 13:00-14:00 (1시간)
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "13:00", endTime: "14:00" },
      { id: "t2", sessionId: "vs1", userId: "u2", date: "2026-04-25", startTime: "13:00", endTime: "14:00" },
      // 4/26: 2명 겹침 15:00-17:00 (2시간)
      { id: "t3", sessionId: "vs1", userId: "u1", date: "2026-04-26", startTime: "15:00", endTime: "17:00" },
      { id: "t4", sessionId: "vs1", userId: "u2", date: "2026-04-26", startTime: "15:00", endTime: "17:00" },
    ];
    const result = getRankedTimeSlots(slots, ["2026-04-25", "2026-04-26"], 2);
    expect(result[0].date).toBe("2026-04-26");
    expect(result[0].endTime).toBe("17:00");
    expect(result[1].date).toBe("2026-04-25");
  });
});
