import { describe, it, expect } from "vitest";
import { mapMemory } from "@/lib/mappers";

describe("mapMemory", () => {
  it("DB row를 Memory 타입으로 변환한다", () => {
    const row = {
      id: "m1",
      group_id: "g1",
      date: "2026-03-28",
      place_id: "p2",
      photos: ["https://example.com/photo.jpg"],
      note: "오랜만에 모여서 즐거웠다",
      created_at: "2026-03-28T12:00:00Z",
    };

    const result = mapMemory(row);

    expect(result).toEqual({
      id: "m1",
      groupId: "g1",
      date: "2026-03-28",
      placeId: "p2",
      photos: ["https://example.com/photo.jpg"],
      note: "오랜만에 모여서 즐거웠다",
      participants: [],
    });
  });

  it("place_id null은 빈 문자열로 변환한다", () => {
    const row = {
      id: "m2",
      group_id: "g1",
      date: "2026-04-01",
      place_id: null,
      photos: [],
      note: null,
      created_at: "2026-04-01T00:00:00Z",
    };

    const result = mapMemory(row);

    expect(result.placeId).toBe("");
    expect(result.note).toBeNull();
    expect(result.participants).toEqual([]);
  });

  it("photos 배열을 그대로 보존한다", () => {
    const photos = ["url1", "url2", "url3"];
    const row = {
      id: "m3",
      group_id: "g2",
      date: "2026-04-10",
      place_id: null,
      photos,
      note: null,
      created_at: "2026-04-10T00:00:00Z",
    };

    expect(mapMemory(row).photos).toEqual(photos);
  });
});
