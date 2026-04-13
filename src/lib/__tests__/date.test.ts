import { describe, it, expect } from "vitest";
import {
  getCalendarDays,
  isSameDay,
  formatMonthYear,
  formatDateShort,
} from "@/lib/date";

describe("getCalendarDays", () => {
  it("6주 * 7일 = 42개 날짜를 반환한다", () => {
    const days = getCalendarDays(new Date(2026, 3, 1));
    expect(days).toHaveLength(42);
  });

  it("4월의 1일은 수요일이므로 앞에 3개의 빈 날짜가 있다", () => {
    const days = getCalendarDays(new Date(2026, 3, 1));
    expect(days[0]).toBeNull();
    expect(days[1]).toBeNull();
    expect(days[2]).toBeNull();
    expect(days[3]?.toDateString()).toBe(new Date(2026, 3, 1).toDateString());
  });
});

describe("isSameDay", () => {
  it("같은 날짜는 true", () => {
    expect(isSameDay(new Date(2026, 3, 13), new Date(2026, 3, 13))).toBe(
      true
    );
  });
  it("다른 날짜는 false", () => {
    expect(isSameDay(new Date(2026, 3, 13), new Date(2026, 3, 14))).toBe(
      false
    );
  });
});

describe("formatMonthYear", () => {
  it("2026년 4월을 반환한다", () => {
    expect(formatMonthYear(new Date(2026, 3, 13))).toBe("2026년 4월");
  });
});

describe("formatDateShort", () => {
  it("4월 13일 형식으로 반환한다", () => {
    expect(formatDateShort(new Date(2026, 3, 13))).toBe("4월 13일");
  });
});
