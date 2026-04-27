import type { Schedule } from "@/types";

export function hasTimeOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function hasConflict(target: Schedule, others: Schedule[]): boolean {
  return others.some(
    (o) =>
      o.id !== target.id &&
      o.date === target.date &&
      hasTimeOverlap(target, o)
  );
}

export function findConflictingGroupIds(daySchedules: Schedule[]): Set<string> {
  const personals = daySchedules.filter((s) => s.type === "personal");
  return new Set(
    daySchedules
      .filter((s) => s.type === "group" && hasConflict(s, personals))
      .map((s) => s.id)
  );
}
