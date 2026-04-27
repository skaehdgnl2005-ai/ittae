"use client";

import { useState, useCallback } from "react";
import type { TimeSlot } from "@/types";

type SelectionState = "idle" | "startSelected";

type PendingStart = { date: string; time: string } | null;

type Range = { startTime: string; endTime: string };

/** 30분 슬롯의 endTime을 계산 (예: "14:00" → "14:30", "14:30" → "15:00") */
function slotEndTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return m === 30 ? `${h + 1}:00` : `${h}:30`;
}

/** ranges 중 해당 time을 포함하는 range를 찾는다 */
function findContainingRange(ranges: Range[], time: string): Range | undefined {
  return ranges.find((r) => time >= r.startTime && time < r.endTime);
}

/** 정렬된 시간 슬롯들을 연속 구간 단위로 묶어 ranges로 변환 */
function timesToRanges(sortedTimes: string[]): Range[] {
  const ranges: Range[] = [];
  let start: string | null = null;
  let lastEnd: string | null = null;
  for (const t of sortedTimes) {
    const tEnd = slotEndTime(t);
    if (start === null) {
      start = t;
      lastEnd = tEnd;
    } else if (t === lastEnd) {
      lastEnd = tEnd;
    } else {
      ranges.push({ startTime: start, endTime: lastEnd! });
      start = t;
      lastEnd = tEnd;
    }
  }
  if (start !== null && lastEnd !== null) {
    ranges.push({ startTime: start, endTime: lastEnd });
  }
  return ranges;
}

/** 겹치거나 인접한 ranges를 병합 (HH:MM 문자열 비교, 시간은 12~19시 범위라 안전) */
function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const merged: Range[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.startTime <= last.endTime) {
      if (cur.endTime > last.endTime) last.endTime = cur.endTime;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function useTimeSlotSelection(initialSlots: TimeSlot[] = []) {
  const [state, setState] = useState<SelectionState>("idle");
  const [pendingStart, setPendingStart] = useState<PendingStart>(null);

  // 날짜별 선택된 범위들
  const [rangesByDate, setRangesByDate] = useState<Record<string, Range[]>>(
    () => {
      const map: Record<string, Range[]> = {};
      for (const slot of initialSlots) {
        if (!map[slot.date]) map[slot.date] = [];
        map[slot.date].push({
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
      return map;
    }
  );

  const getSelectedRanges = useCallback(
    (date: string): Range[] => rangesByDate[date] ?? [],
    [rangesByDate]
  );

  const isSlotSelected = useCallback(
    (date: string, time: string): boolean => {
      const ranges = rangesByDate[date] ?? [];
      return ranges.some((r) => time >= r.startTime && time < r.endTime);
    },
    [rangesByDate]
  );

  const handleCellClick = useCallback(
    (date: string, time: string) => {
      const ranges = rangesByDate[date] ?? [];

      // 이미 선택된 셀 클릭 → 해당 구간 전체 해제
      const containingRange = findContainingRange(ranges, time);
      if (containingRange) {
        setRangesByDate((prev) => ({
          ...prev,
          [date]: (prev[date] ?? []).filter((r) => r !== containingRange),
        }));
        setState("idle");
        setPendingStart(null);
        return;
      }

      if (state === "idle") {
        // 시작점 선택
        setState("startSelected");
        setPendingStart({ date, time });
        return;
      }

      // state === "startSelected"
      if (pendingStart && pendingStart.date !== date) {
        // 다른 열 클릭 → 리셋 후 새 열에서 시작
        setState("startSelected");
        setPendingStart({ date, time });
        return;
      }

      if (pendingStart && pendingStart.time === time) {
        // 같은 셀 재클릭 → 취소
        setState("idle");
        setPendingStart(null);
        return;
      }

      // 끝점 선택 → 범위 완성
      if (pendingStart) {
        let start = pendingStart.time;
        let end = time;
        if (start > end) [start, end] = [end, start];

        const newRange: Range = {
          startTime: start,
          endTime: slotEndTime(end),
        };

        setRangesByDate((prev) => ({
          ...prev,
          [date]: [...(prev[date] ?? []), newRange],
        }));
        setState("idle");
        setPendingStart(null);
      }
    },
    [state, pendingStart, rangesByDate]
  );

  /** 드래그 스윕 결과를 ranges로 변환 후 기존 ranges와 병합 */
  const commitSweptSlots = useCallback((slotIds: string[]) => {
    if (slotIds.length === 0) return;
    const byDate: Record<string, string[]> = {};
    for (const id of slotIds) {
      const sepIdx = id.indexOf("T");
      if (sepIdx < 0) continue;
      const date = id.slice(0, sepIdx);
      const time = id.slice(sepIdx + 1);
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(time);
    }

    setRangesByDate((prev) => {
      const next = { ...prev };
      for (const date of Object.keys(byDate)) {
        const sortedTimes = byDate[date].slice().sort();
        const newRanges = timesToRanges(sortedTimes);
        const existing = prev[date] ?? [];
        next[date] = mergeRanges([...existing, ...newRanges]);
      }
      return next;
    });
    setState("idle");
    setPendingStart(null);
  }, []);

  /** 외부 데이터로 범위 리셋 (realtime 업데이트 시 사용) */
  const resetFromSlots = useCallback((slots: TimeSlot[]) => {
    const map: Record<string, Range[]> = {};
    for (const slot of slots) {
      if (!map[slot.date]) map[slot.date] = [];
      map[slot.date].push({
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }
    setRangesByDate(map);
  }, []);

  return {
    state,
    pendingStart,
    handleCellClick,
    commitSweptSlots,
    getSelectedRanges,
    isSlotSelected,
    resetFromSlots,
    rangesByDate,
  };
}
