import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay as dfnsSameDay,
  format,
  addMonths,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";

/** 캘린더 그리드용 42칸 배열 (빈 칸은 null) */
export function getCalendarDays(date: Date): (Date | null)[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const daysInMonth = eachDayOfInterval({ start, end });

  const grid: (Date | null)[] = [];
  const firstDayOfWeek = start.getDay(); // 0=일

  for (let i = 0; i < firstDayOfWeek; i++) {
    grid.push(null);
  }

  daysInMonth.forEach((d) => {
    grid.push(d);
  });

  while (grid.length < 42) {
    grid.push(null);
  }

  return grid;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dfnsSameDay(a, b);
}

export function formatMonthYear(date: Date): string {
  return format(date, "yyyy년 M월", { locale: ko });
}

export function formatDateShort(date: Date): string {
  return format(date, "M월 d일", { locale: ko });
}

export function formatTime(time: string): string {
  // "14:00" → "오후 2:00"
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${hour}:${m.toString().padStart(2, "0")}`;
}

export { addMonths, subMonths };
