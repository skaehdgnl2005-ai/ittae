import { DAYS_OF_WEEK, type ParsedClass } from "@/lib/everytime/types";
import type { PreviewItem } from "@/components/calendar/EverytimePreviewStep";

export type Step = "upload" | "analyzing" | "preview" | "saving";

export const MAX_BYTES = 5 * 1024 * 1024;
const TIME_RE = /^\d{2}:\d{2}$/;

export function flagOf(c: ParsedClass): PreviewItem["flag"] {
  if (!c.title.trim()) return "missing_title";
  if (!DAYS_OF_WEEK.includes(c.dayOfWeek)) return "invalid_day";
  if (!TIME_RE.test(c.startTime) || !TIME_RE.test(c.endTime)) return "invalid_time";
  if (c.startTime >= c.endTime) return "end_before_start";
  return null;
}
