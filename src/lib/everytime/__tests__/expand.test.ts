import { describe, it, expect } from "vitest";
import { expandClasses } from "@/lib/everytime/expand";
import type { ParsedClass } from "@/lib/everytime/types";

describe("expandClasses", () => {
  it("월요일 1과목을 1학기 전체에 매주 펼친다 (2026-03-02 ~ 2026-03-30, 5주)", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-30",
    });
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.date)).toEqual([
      "2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30",
    ]);
    expect(rows[0].title).toBe("자료구조");
    expect(rows[0].start_time).toBe("09:00");
    expect(rows[0].end_time).toBe("10:30");
    expect(rows[0].memo).toBe("IT405");
  });

  it("같은 (title, location) 그룹은 같은 everytime_class_id를 공유한다", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
      { title: "자료구조", dayOfWeek: "WED", startTime: "09:00", endTime: "10:30", location: "IT405" },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-08",
    });
    expect(rows).toHaveLength(2); // 월·수 1주씩
    expect(rows[0].everytime_class_id).toBe(rows[1].everytime_class_id);
  });

  it("다른 (title, location) 그룹은 다른 uuid를 가진다", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
      { title: "운영체제", dayOfWeek: "TUE", startTime: "13:00", endTime: "14:30", location: "공학관 201" },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-08",
    });
    expect(rows[0].everytime_class_id).not.toBe(rows[1].everytime_class_id);
  });

  it("location이 null인 entry끼리도 같은 title이면 한 그룹", () => {
    const classes: ParsedClass[] = [
      { title: "교양체육", dayOfWeek: "MON", startTime: "10:00", endTime: "12:00", location: null },
      { title: "교양체육", dayOfWeek: "WED", startTime: "10:00", endTime: "12:00", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-08",
    });
    expect(rows[0].everytime_class_id).toBe(rows[1].everytime_class_id);
    expect(rows[0].memo).toBeNull();
  });

  it("(dayOfWeek, startTime, endTime) 완전 중복 entry는 dedup 한다", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-02",
    });
    expect(rows).toHaveLength(1);
  });

  it("학기 시작일이 일요일이면 그 주의 월요일 수업도 포함된다", () => {
    // 2026-03-01 (일) ~ 2026-03-08 (일), MON 수업
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-01",
      semesterEnd: "2026-03-08",
    });
    expect(rows.map((r) => r.date)).toEqual(["2026-03-02"]);
  });

  it("시작=종료일이고 그 날 요일 수업이 없으면 빈 배열", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-03", // 화요일
      semesterEnd: "2026-03-03",
    });
    expect(rows).toEqual([]);
  });

  it("종료가 시작보다 이르면 빈 배열", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-06-19",
      semesterEnd: "2026-03-02",
    });
    expect(rows).toEqual([]);
  });

  it("KST: 2026-03-02 문자열은 월요일로 정확히 인식된다 (UTC 변환 안 함)", () => {
    const classes: ParsedClass[] = [
      { title: "T", dayOfWeek: "MON", startTime: "09:00", endTime: "10:00", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-02",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-03-02");
  });
});
