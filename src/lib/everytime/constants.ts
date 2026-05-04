export type SemesterPreset = {
  id: "spring" | "fall";
  label: string;
  start: string; // "YYYY-MM-DD"
  end: string;
};

// 고려대 2026 학사력 — Task 0에서 확정한 날짜로 갱신 예정 (현재는 spec 디폴트)
export const SEMESTER_PRESETS: SemesterPreset[] = [
  { id: "spring", label: "1학기", start: "2026-03-02", end: "2026-06-19" },
  { id: "fall", label: "2학기", start: "2026-09-01", end: "2026-12-18" },
];

export function getDefaultSemesterPreset(today: Date): SemesterPreset {
  const month = today.getMonth() + 1;
  // 7~12월: 2학기 디폴트, 1~6월: 1학기 디폴트
  return month >= 7 ? SEMESTER_PRESETS[1] : SEMESTER_PRESETS[0];
}
