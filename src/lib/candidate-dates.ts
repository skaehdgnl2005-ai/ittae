import { format, isBefore, startOfDay } from "date-fns";
import { ko } from "date-fns/locale";

/** 날짜 토글: 있으면 제거, 없으면 정렬 삽입 */
export function toggleCandidateDate(
  dates: string[],
  dateStr: string
): string[] {
  if (dates.includes(dateStr)) {
    return dates.filter((d) => d !== dateStr);
  }
  return [...dates, dateStr].sort();
}

/** 오늘 이전이면 true */
export function isPastDate(date: Date): boolean {
  return isBefore(startOfDay(date), startOfDay(new Date()));
}

/** "YYYY-MM-DD" → "M월 d일 EEE" (예: "5월 1일 금") */
export function formatCandidateChip(dateStr: string): string {
  return format(new Date(dateStr), "M월 d일 EEE", { locale: ko });
}
