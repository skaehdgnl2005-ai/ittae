import { describe, it, expect } from "vitest";
import {
  getBestTimeSlot,
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
