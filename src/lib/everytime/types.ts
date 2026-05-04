export const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

/** Gemini가 반환 + 사용자가 미리보기에서 편집한 한 셀 */
export type ParsedClass = {
  title: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:MM" 24h, 항상 2자리
  endTime: string;
  location: string | null;
};

/** RPC payload용 펼쳐진 단일 row */
export type ExpandedRow = {
  title: string;
  date: string; // "YYYY-MM-DD"
  start_time: string;
  end_time: string;
  memo: string | null;
  everytime_class_id: string;
};

/** 미리보기에서 ⚠ 사유 */
export type ValidationFlag =
  | "missing_title"
  | "invalid_day"
  | "invalid_time_format"
  | "end_before_start";
