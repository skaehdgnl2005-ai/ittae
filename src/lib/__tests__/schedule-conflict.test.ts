import { describe, it, expect } from "vitest";
import {
  hasTimeOverlap,
  hasConflict,
  findConflictingGroupIds,
} from "@/lib/schedule-conflict";
import type { Schedule } from "@/types";

function makeSchedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: "default-id",
    userId: "user-1",
    title: "test",
    date: "2026-04-30",
    startTime: "14:00",
    endTime: "15:00",
    memo: null,
    type: "personal",
    source: "manual",
    externalEventId: null,
    ...overrides,
  };
}

describe("hasTimeOverlap", () => {
  it("시간 완전 일치는 겹침", () => {
    expect(
      hasTimeOverlap(
        { startTime: "14:00", endTime: "15:00" },
        { startTime: "14:00", endTime: "15:00" }
      )
    ).toBe(true);
  });

  it("일부 겹침 (시작 부분)", () => {
    expect(
      hasTimeOverlap(
        { startTime: "14:00", endTime: "15:00" },
        { startTime: "14:30", endTime: "16:00" }
      )
    ).toBe(true);
  });

  it("일부 겹침 (끝 부분)", () => {
    expect(
      hasTimeOverlap(
        { startTime: "14:00", endTime: "16:00" },
        { startTime: "13:00", endTime: "14:30" }
      )
    ).toBe(true);
  });

  it("한쪽이 다른 쪽 포함", () => {
    expect(
      hasTimeOverlap(
        { startTime: "12:00", endTime: "20:00" },
        { startTime: "14:00", endTime: "15:00" }
      )
    ).toBe(true);
  });

  it("종일 이벤트(00:00~23:59)와 부분 겹침", () => {
    expect(
      hasTimeOverlap(
        { startTime: "00:00", endTime: "23:59" },
        { startTime: "14:00", endTime: "15:00" }
      )
    ).toBe(true);
  });

  it("인접하지만 안 겹침", () => {
    expect(
      hasTimeOverlap(
        { startTime: "14:00", endTime: "15:00" },
        { startTime: "15:00", endTime: "16:00" }
      )
    ).toBe(false);
  });

  it("완전히 떨어진 시간", () => {
    expect(
      hasTimeOverlap(
        { startTime: "10:00", endTime: "11:00" },
        { startTime: "14:00", endTime: "15:00" }
      )
    ).toBe(false);
  });

  it("빈 문자열은 false", () => {
    expect(
      hasTimeOverlap(
        { startTime: "", endTime: "" },
        { startTime: "14:00", endTime: "15:00" }
      )
    ).toBe(false);
  });
});

describe("hasConflict", () => {
  it("자기 자신과는 충돌 아님", () => {
    const a = makeSchedule({ id: "a" });
    expect(hasConflict(a, [a])).toBe(false);
  });

  it("다른 날짜는 안 겹침", () => {
    const target = makeSchedule({ id: "a", date: "2026-04-30" });
    const others = [makeSchedule({ id: "b", date: "2026-05-01" })];
    expect(hasConflict(target, others)).toBe(false);
  });

  it("같은 날 시간 겹치면 충돌", () => {
    const target = makeSchedule({ id: "a", startTime: "14:00", endTime: "15:00" });
    const others = [
      makeSchedule({ id: "b", startTime: "14:30", endTime: "16:00" }),
    ];
    expect(hasConflict(target, others)).toBe(true);
  });

  it("빈 배열이면 false", () => {
    const target = makeSchedule({ id: "a" });
    expect(hasConflict(target, [])).toBe(false);
  });
});

describe("findConflictingGroupIds", () => {
  it("group과 겹치는 personal이 있을 때 group id 반환", () => {
    const personal = makeSchedule({
      id: "p1",
      type: "personal",
      startTime: "14:00",
      endTime: "15:00",
    });
    const group = makeSchedule({
      id: "g1",
      type: "group",
      startTime: "14:30",
      endTime: "16:00",
    });
    const result = findConflictingGroupIds([personal, group]);
    expect(result.has("g1")).toBe(true);
    expect(result.has("p1")).toBe(false);
  });

  it("personal끼리만 있으면 빈 set", () => {
    const p1 = makeSchedule({ id: "p1", type: "personal" });
    const p2 = makeSchedule({
      id: "p2",
      type: "personal",
      startTime: "14:30",
      endTime: "16:00",
    });
    const result = findConflictingGroupIds([p1, p2]);
    expect(result.size).toBe(0);
  });

  it("Google source도 personal이면 충돌 트리거", () => {
    const google = makeSchedule({
      id: "google-1",
      type: "personal",
      source: "google",
      startTime: "14:00",
      endTime: "15:00",
    });
    const group = makeSchedule({
      id: "g1",
      type: "group",
      startTime: "14:30",
      endTime: "16:00",
    });
    const result = findConflictingGroupIds([google, group]);
    expect(result.has("g1")).toBe(true);
  });

  it("종일 이벤트는 그날 모든 group 카드와 충돌", () => {
    const allDay = makeSchedule({
      id: "p1",
      type: "personal",
      startTime: "00:00",
      endTime: "23:59",
    });
    const g1 = makeSchedule({ id: "g1", type: "group", startTime: "10:00", endTime: "11:00" });
    const g2 = makeSchedule({ id: "g2", type: "group", startTime: "18:00", endTime: "19:00" });
    const result = findConflictingGroupIds([allDay, g1, g2]);
    expect(result.has("g1")).toBe(true);
    expect(result.has("g2")).toBe(true);
  });
});
