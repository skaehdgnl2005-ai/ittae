"use client";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type ParsedClass,
} from "@/lib/everytime/types";

export type PreviewItem = ParsedClass & {
  checked: boolean;
  flag: "missing_title" | "invalid_day" | "invalid_time" | "end_before_start" | null;
};

const DAY_LABEL: Record<DayOfWeek, string> = {
  MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토", SUN: "일",
};

type Props = {
  items: PreviewItem[];
  hasExistingEverytime: boolean;
  existingCount: number;
  error: string | null;
  onUpdate: (index: number, patch: Partial<ParsedClass>) => void;
  onToggle: (index: number) => void;
  onImport: () => void;
  onCancel: () => void;
};

export function EverytimePreviewStep({
  items,
  hasExistingEverytime,
  existingCount,
  error,
  onUpdate,
  onToggle,
  onImport,
  onCancel,
}: Props) {
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <>
      {hasExistingEverytime && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-xs text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          기존에 가져온 에브리타임 일정 {existingCount}개가 교체됩니다.
        </div>
      )}
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div
            key={idx}
            className={cn(
              "rounded-xl border px-3 py-2.5",
              it.flag
                ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
            )}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={it.checked}
                disabled={it.flag !== null}
                onChange={() => onToggle(idx)}
                className="h-5 w-5 accent-violet-600 disabled:opacity-40"
              />
              <input
                type="text"
                value={it.title}
                onChange={(e) => onUpdate(idx, { title: e.target.value })}
                className="flex-1 min-w-0 h-9 px-2 text-sm rounded border border-transparent focus:border-violet-500 focus:outline-none bg-transparent text-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="grid grid-cols-[40px_1fr_1fr] gap-2 mt-1.5 pl-7">
              <select
                value={it.dayOfWeek}
                onChange={(e) => onUpdate(idx, { dayOfWeek: e.target.value as DayOfWeek })}
                className="h-9 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>{DAY_LABEL[d]}</option>
                ))}
              </select>
              <input
                type="time"
                step={1800}
                value={it.startTime}
                onChange={(e) => onUpdate(idx, { startTime: e.target.value })}
                className="h-9 px-2 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              />
              <input
                type="time"
                step={1800}
                value={it.endTime}
                onChange={(e) => onUpdate(idx, { endTime: e.target.value })}
                className="h-9 px-2 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              />
            </div>
            <input
              type="text"
              value={it.location ?? ""}
              onChange={(e) => onUpdate(idx, { location: e.target.value || null })}
              placeholder="(장소 선택)"
              className="mt-1.5 ml-7 w-[calc(100%-1.75rem)] h-9 px-2 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 placeholder:text-gray-400"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-2 pt-2">
        <Button variant="primary" onClick={onImport} disabled={checkedCount === 0}>
          {checkedCount}개 추가
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
      </div>
    </>
  );
}
