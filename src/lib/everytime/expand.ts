import { randomUUID } from "node:crypto";
import type { DayOfWeek, ParsedClass, ExpandedRow } from "@/lib/everytime/types";

type Args = {
  classes: ParsedClass[];
  semesterStart: string; // "YYYY-MM-DD"
  semesterEnd: string;
};

const DAY_TO_INDEX: Record<DayOfWeek, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

/** "YYYY-MM-DD" → 로컬 타임존 Date (UTC 해석 회피) */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function groupKey(c: ParsedClass): string {
  return `${c.title}__${c.location ?? ""}`;
}

function entryKey(c: ParsedClass): string {
  return `${c.dayOfWeek}__${c.startTime}__${c.endTime}`;
}

export function expandClasses({ classes, semesterStart, semesterEnd }: Args): ExpandedRow[] {
  const start = parseLocalDate(semesterStart);
  const end = parseLocalDate(semesterEnd);
  if (end < start) return [];

  // 1. (title, location) 그룹별 uuid 부여
  const groupIds = new Map<string, string>();
  for (const c of classes) {
    const key = groupKey(c);
    if (!groupIds.has(key)) groupIds.set(key, randomUUID());
  }

  // 2. (group, day, start, end) dedup
  const seen = new Set<string>();
  const dedupedClasses: ParsedClass[] = [];
  for (const c of classes) {
    const key = `${groupKey(c)}__${entryKey(c)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedClasses.push(c);
  }

  // 3. 펼치기
  const rows: ExpandedRow[] = [];
  for (const c of dedupedClasses) {
    const targetDow = DAY_TO_INDEX[c.dayOfWeek];
    const cur = new Date(start);
    while (cur <= end) {
      if (cur.getDay() === targetDow) {
        rows.push({
          title: c.title,
          date: toIsoDate(cur),
          start_time: c.startTime,
          end_time: c.endTime,
          memo: c.location,
          everytime_class_id: groupIds.get(groupKey(c))!,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return rows;
}
