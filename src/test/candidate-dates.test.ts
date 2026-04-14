import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  toggleCandidateDate,
  isPastDate,
  formatCandidateChip,
} from "@/lib/candidate-dates";

describe("toggleCandidateDate", () => {
  it("날짜가 없으면 추가한다", () => {
    expect(toggleCandidateDate([], "2026-05-01")).toEqual(["2026-05-01"]);
  });

  it("이미 있는 날짜는 제거한다", () => {
    expect(
      toggleCandidateDate(["2026-05-01", "2026-05-02"], "2026-05-01")
    ).toEqual(["2026-05-02"]);
  });

  it("없는 날짜는 정렬하여 추가한다", () => {
    expect(
      toggleCandidateDate(["2026-05-03"], "2026-05-01")
    ).toEqual(["2026-05-01", "2026-05-03"]);
  });
});

describe("isPastDate", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-14"));
  });

  it("오늘은 과거가 아니다", () => {
    expect(isPastDate(new Date("2026-04-14"))).toBe(false);
  });

  it("어제는 과거다", () => {
    expect(isPastDate(new Date("2026-04-13"))).toBe(true);
  });

  it("내일은 과거가 아니다", () => {
    expect(isPastDate(new Date("2026-04-15"))).toBe(false);
  });
});

describe("formatCandidateChip", () => {
  it('"2026-05-01" → "5월 1일 금"', () => {
    expect(formatCandidateChip("2026-05-01")).toBe("5월 1일 금");
  });
});
