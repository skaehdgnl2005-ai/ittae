import { describe, it, expect } from "vitest";
import { googleEventToScheduleInsert } from "@/lib/google/sync";
import type { GoogleEvent } from "@/lib/google/calendar-api";

const userId = "user-1";

describe("googleEventToScheduleInsert", () => {
  it("종일 이벤트 → 00:00/23:59 매핑", () => {
    const event: GoogleEvent = {
      id: "evt-1",
      summary: "공휴일",
      status: "confirmed",
      start: { date: "2026-05-05" },
      end: { date: "2026-05-06" },
    };
    const result = googleEventToScheduleInsert(event, userId);
    expect(result.date).toBe("2026-05-05");
    expect(result.start_time).toBe("00:00");
    expect(result.end_time).toBe("23:59");
    expect(result.title).toBe("공휴일");
    expect(result.source).toBe("google");
    expect(result.external_event_id).toBe("evt-1");
  });

  it("시간 이벤트 KST 변환 (UTC 05:00 → KST 14:00)", () => {
    const event: GoogleEvent = {
      id: "evt-2",
      summary: "회의",
      status: "confirmed",
      start: { dateTime: "2026-04-30T05:00:00Z" },
      end: { dateTime: "2026-04-30T06:00:00Z" },
    };
    const result = googleEventToScheduleInsert(event, userId);
    expect(result.date).toBe("2026-04-30");
    expect(result.start_time).toBe("14:00");
    expect(result.end_time).toBe("15:00");
  });

  it("자정 가까운 KST 시간(UTC 15:00 → KST 다음날 00:00)", () => {
    const event: GoogleEvent = {
      id: "evt-3",
      summary: "야간 일정",
      status: "confirmed",
      start: { dateTime: "2026-04-30T15:00:00Z" },
      end: { dateTime: "2026-04-30T16:00:00Z" },
    };
    const result = googleEventToScheduleInsert(event, userId);
    expect(result.date).toBe("2026-05-01");
    expect(result.start_time).toBe("00:00");
    expect(result.end_time).toBe("01:00");
  });

  it("private visibility → 제목 마스킹", () => {
    const event: GoogleEvent = {
      id: "evt-4",
      summary: "치과 진료",
      visibility: "private",
      status: "confirmed",
      start: { dateTime: "2026-04-30T05:00:00Z" },
      end: { dateTime: "2026-04-30T06:00:00Z" },
    };
    const result = googleEventToScheduleInsert(event, userId);
    expect(result.title).toBe("(비공개 일정)");
  });

  it("summary 없으면 '제목 없음'", () => {
    const event: GoogleEvent = {
      id: "evt-5",
      status: "confirmed",
      start: { dateTime: "2026-04-30T05:00:00Z" },
      end: { dateTime: "2026-04-30T06:00:00Z" },
    };
    const result = googleEventToScheduleInsert(event, userId);
    expect(result.title).toBe("제목 없음");
  });

  it("etag 보존", () => {
    const event: GoogleEvent = {
      id: "evt-6",
      summary: "test",
      status: "confirmed",
      start: { dateTime: "2026-04-30T05:00:00Z" },
      end: { dateTime: "2026-04-30T06:00:00Z" },
      etag: '"123456"',
    };
    const result = googleEventToScheduleInsert(event, userId);
    expect(result.external_etag).toBe('"123456"');
  });
});
