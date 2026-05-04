# 에브리타임 시간표 OCR 가져오기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 에브리타임 시간표 스크린샷 한 장을 Gemini 2.5 Flash로 인식해 학기 전 기간 매주 반복되는 personal 일정으로 자동 추가한다.

**Architecture:** Gemini Vision으로 격자 인식 → JSON 파싱 → 미리보기 게이트(사용자 검증/편집) → Postgres RPC로 delete-then-insert 단일 트랜잭션. 같은 과목 row들은 `(title, location)` 자연키로 그룹화 후 `everytime_class_id` uuid 공유.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS + RPC), Gemini API (`@google/genai`), shadcn/ui Sheet, Vitest

**Spec:** `docs/superpowers/specs/2026-05-01-everytime-ocr-design.md`

---

## File Structure

**Created:**
- `supabase/migrations/007_everytime_import.sql` — source enum 확장 + everytime_class_id + RPC
- `src/lib/everytime/types.ts` — `DayOfWeek`, `ParsedClass`, `ExpandedRow` shared types
- `src/lib/everytime/expand.ts` — 학기 펼치기 + 그룹핑 + dedup 순수 함수
- `src/lib/everytime/__tests__/expand.test.ts` — 단위 테스트
- `src/lib/everytime/constants.ts` — 학기 프리셋 (고려대 2026)
- `src/lib/gemini/client.ts` — Gemini SDK 래퍼
- `src/lib/gemini/prompts/everytime.ts` — 시간표 분석 프롬프트
- `src/app/api/everytime/parse/route.ts` — 이미지 → JSON
- `src/app/api/everytime/import/route.ts` — POST(import) + DELETE(전체 삭제)
- `src/components/calendar/EverytimeImportButton.tsx` — 진입 버튼
- `src/components/calendar/EverytimeImportSheet.tsx` — 4-step 시트 (state machine 전체 한 파일, 200줄 초과 시 step 컴포넌트 분리)

**Modified:**
- `src/types/index.ts` — `ScheduleSource`에 `'everytime'` 추가
- `src/lib/mappers.ts` — `mapSchedule`이 새 source 값을 자연스럽게 통과 (현재도 `row.source` 직접 통과하므로 타입만 맞으면 OK)
- `src/app/(main)/home/page.tsx` — `EverytimeImportButton` 헤더에 추가, `hasEverytimeSchedules` 계산 후 prop 전달
- `.env.local.example` (있다면) — `GEMINI_API_KEY` 추가

---

## Task 0: 학사력 확인 + 의존성 설치

**Files:** 없음 (수동 확인 + npm install)

- [ ] **Step 1: 고려대 2026 학사력 확인**

[고려대학교 학사일정](https://registrar.korea.ac.kr/)에서 다음 두 날짜 확인 후 spec 갱신:
- 1학기 시작일 (개강일, 보통 3월 첫 월요일)
- 1학기 종료일 (시험기간 마지막 날 포함)
- 2학기 시작일 (개강일, 보통 9월 첫 월요일)
- 2학기 종료일 (시험기간 마지막 날 포함)

확인 결과를 spec의 "학기 범위 입력" 섹션에 fix하고 commit. 만약 spec의 디폴트(`2026-03-02 ~ 2026-06-19`, `2026-09-01 ~ 2026-12-18`)가 그대로 정확하면 ⚠ 표시만 제거하고 commit.

- [ ] **Step 2: Gemini SDK 설치**

```bash
pnpm add @google/genai
```

- [ ] **Step 3: 환경변수 추가**

`.env.local`에 다음 줄 추가 (`.gitignore` 됨):

```
GEMINI_API_KEY=your_api_key_here
```

`.env.local.example` 파일이 있으면 같이 추가 (값은 빈 문자열).

- [ ] **Step 4: API 키 발급**

[Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료 키 발급 후 `.env.local`에 붙여넣기. 시연 단계에선 무료 quota 충분.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml docs/superpowers/specs/2026-05-01-everytime-ocr-design.md
git commit -m "chore(everytime): @google/genai 설치 + 학사력 확정"
```

---

## Task 1: 마이그레이션 007 — schema + RPC

**Files:**
- Create: `supabase/migrations/007_everytime_import.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/007_everytime_import.sql`:

```sql
-- ============================================================
-- 007_everytime_import.sql
-- 에브리타임 시간표 OCR import:
--   - schedules.source check에 'everytime' 추가
--   - schedules.everytime_class_id (그룹 키)
--   - replace_everytime_schedules RPC (delete-then-insert 단일 트랜잭션)
-- 생성일: 2026-05-01
-- ============================================================

-- 1. source check 제약 확장
alter table schedules drop constraint if exists schedules_source_check;
alter table schedules add constraint schedules_source_check
  check (source in ('manual', 'google', 'everytime'));

-- 2. 같은 과목 row 그룹 키
alter table schedules add column everytime_class_id uuid;

-- 3. 사용자별 everytime 일정 일괄 조회·삭제용 인덱스
create index schedules_everytime_idx
  on schedules(user_id, everytime_class_id)
  where source = 'everytime';

-- 4. delete-then-insert 원자성용 RPC
create or replace function replace_everytime_schedules(
  p_user_id uuid,
  p_payloads jsonb
) returns int
language plpgsql
security invoker
as $$
declare
  v_inserted int;
begin
  if auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  delete from schedules where user_id = p_user_id and source = 'everytime';

  insert into schedules (user_id, title, date, start_time, end_time, memo, source, everytime_class_id)
  select
    p_user_id,
    (p->>'title')::text,
    (p->>'date')::date,
    (p->>'start_time')::time,
    (p->>'end_time')::time,
    nullif(p->>'memo', ''),
    'everytime',
    (p->>'everytime_class_id')::uuid
  from jsonb_array_elements(p_payloads) p;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
```

- [ ] **Step 2: 로컬 Supabase에 적용**

```bash
pnpm dlx supabase db reset
```

또는 supabase CLI를 직접 쓰지 않고 Supabase Studio (브라우저)의 SQL Editor에 위 SQL을 그대로 붙여넣고 실행해도 됨.

Expected: 에러 없이 완료. Studio의 schedules 테이블에 `everytime_class_id` 컬럼이 보이고, Database → Functions에 `replace_everytime_schedules`가 보임.

- [ ] **Step 3: 타입 재생성**

```bash
pnpm db:types
```

`src/types/supabase.ts`가 갱신되어 `schedules` Row 타입에 `everytime_class_id: string | null`이 포함되고, `Functions.replace_everytime_schedules`가 추가됨.

- [ ] **Step 4: 타입 변화 확인**

```bash
pnpm typecheck
```

Expected: 에러 없음 (기존 mapSchedule이 새 컬럼을 무시하므로 통과).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_everytime_import.sql src/types/supabase.ts
git commit -m "feat(db): 007_everytime_import — source enum + RPC + class group key"
```

---

## Task 2: 타입 확장 — ScheduleSource

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: ScheduleSource에 'everytime' 추가**

`src/types/index.ts:81`:

```ts
export type ScheduleSource = "manual" | "google" | "everytime";
```

- [ ] **Step 2: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): ScheduleSource에 'everytime' 추가"
```

---

## Task 3: 학기 프리셋 상수

**Files:**
- Create: `src/lib/everytime/constants.ts`

- [ ] **Step 1: 상수 파일 작성**

Task 0에서 확정한 학사력 날짜를 사용. 아래는 spec 디폴트:

`src/lib/everytime/constants.ts`:

```ts
export type SemesterPreset = {
  id: "spring" | "fall";
  label: string;
  start: string; // "YYYY-MM-DD"
  end: string;
};

// 고려대 2026 학사력 — Task 0에서 확정한 날짜로 갱신
export const SEMESTER_PRESETS: SemesterPreset[] = [
  { id: "spring", label: "1학기", start: "2026-03-02", end: "2026-06-19" },
  { id: "fall", label: "2학기", start: "2026-09-01", end: "2026-12-18" },
];

export function getDefaultSemesterPreset(today: Date): SemesterPreset {
  const month = today.getMonth() + 1;
  // 7~12월: 2학기 디폴트, 1~6월: 1학기 디폴트
  return month >= 7 ? SEMESTER_PRESETS[1] : SEMESTER_PRESETS[0];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/everytime/constants.ts
git commit -m "feat(everytime): 학기 프리셋 상수 (고려대 2026)"
```

---

## Task 4: 공유 타입 정의

**Files:**
- Create: `src/lib/everytime/types.ts`

- [ ] **Step 1: 타입 파일 작성**

`src/lib/everytime/types.ts`:

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/everytime/types.ts
git commit -m "feat(everytime): DayOfWeek / ParsedClass / ExpandedRow 타입"
```

---

## Task 5: expand.ts — 펼치기 함수 (TDD)

**Files:**
- Create: `src/lib/everytime/expand.ts`
- Create: `src/lib/everytime/__tests__/expand.test.ts`

이 task는 단위 테스트 우선 작성 후 구현하는 TDD 방식으로 진행.

- [ ] **Step 1: 테스트 파일 작성 (실패하는 상태)**

`src/lib/everytime/__tests__/expand.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { expandClasses } from "@/lib/everytime/expand";
import type { ParsedClass } from "@/lib/everytime/types";

describe("expandClasses", () => {
  it("월요일 1과목을 1학기 전체에 매주 펼친다 (2026-03-02 ~ 2026-03-30, 5주)", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-30",
    });
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.date)).toEqual([
      "2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30",
    ]);
    expect(rows[0].title).toBe("자료구조");
    expect(rows[0].start_time).toBe("09:00");
    expect(rows[0].end_time).toBe("10:30");
    expect(rows[0].memo).toBe("IT405");
  });

  it("같은 (title, location) 그룹은 같은 everytime_class_id를 공유한다", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
      { title: "자료구조", dayOfWeek: "WED", startTime: "09:00", endTime: "10:30", location: "IT405" },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-08",
    });
    expect(rows).toHaveLength(2); // 월·수 1주씩
    expect(rows[0].everytime_class_id).toBe(rows[1].everytime_class_id);
  });

  it("다른 (title, location) 그룹은 다른 uuid를 가진다", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
      { title: "운영체제", dayOfWeek: "TUE", startTime: "13:00", endTime: "14:30", location: "공학관 201" },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-08",
    });
    expect(rows[0].everytime_class_id).not.toBe(rows[1].everytime_class_id);
  });

  it("location이 null인 entry끼리도 같은 title이면 한 그룹", () => {
    const classes: ParsedClass[] = [
      { title: "교양체육", dayOfWeek: "MON", startTime: "10:00", endTime: "12:00", location: null },
      { title: "교양체육", dayOfWeek: "WED", startTime: "10:00", endTime: "12:00", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-08",
    });
    expect(rows[0].everytime_class_id).toBe(rows[1].everytime_class_id);
    expect(rows[0].memo).toBeNull();
  });

  it("(dayOfWeek, startTime, endTime) 완전 중복 entry는 dedup 한다", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: "IT405" },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-02",
    });
    expect(rows).toHaveLength(1);
  });

  it("학기 시작일이 일요일이면 그 주의 월요일 수업도 포함된다", () => {
    // 2026-03-01 (일) ~ 2026-03-08 (일), MON 수업
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-01",
      semesterEnd: "2026-03-08",
    });
    expect(rows.map((r) => r.date)).toEqual(["2026-03-02"]);
  });

  it("시작=종료일이고 그 날 요일 수업이 없으면 빈 배열", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-03", // 화요일
      semesterEnd: "2026-03-03",
    });
    expect(rows).toEqual([]);
  });

  it("종료가 시작보다 이르면 빈 배열", () => {
    const classes: ParsedClass[] = [
      { title: "자료구조", dayOfWeek: "MON", startTime: "09:00", endTime: "10:30", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-06-19",
      semesterEnd: "2026-03-02",
    });
    expect(rows).toEqual([]);
  });

  it("KST: 2026-03-02 문자열은 월요일로 정확히 인식된다 (UTC 변환 안 함)", () => {
    const classes: ParsedClass[] = [
      { title: "T", dayOfWeek: "MON", startTime: "09:00", endTime: "10:00", location: null },
    ];
    const rows = expandClasses({
      classes,
      semesterStart: "2026-03-02",
      semesterEnd: "2026-03-02",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-03-02");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm test src/lib/everytime/__tests__/expand.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/everytime/expand'`

- [ ] **Step 3: expand.ts 구현**

`src/lib/everytime/expand.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

```bash
pnpm test src/lib/everytime/__tests__/expand.test.ts
```

Expected: PASS — 9개 테스트 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add src/lib/everytime/expand.ts src/lib/everytime/__tests__/expand.test.ts
git commit -m "feat(everytime): expandClasses — 학기 펼치기 + 그룹핑 + dedup"
```

---

## Task 6: Gemini 프롬프트 + PoC

**Files:**
- Create: `src/lib/gemini/prompts/everytime.ts`
- Create: `src/lib/gemini/client.ts`

- [ ] **Step 1: 프롬프트 작성**

`src/lib/gemini/prompts/everytime.ts`:

```ts
export const EVERYTIME_TIMETABLE_PROMPT = `이 이미지는 한국 대학교 시간표 스크린샷입니다 (에브리타임 앱 스타일의 격자형 시간표).

다음 규칙으로 수업 정보만 추출해 주세요:
1. 격자의 행은 시간(아침~저녁), 열은 요일(월~일).
2. 색깔이 칠해진 블록만 수업입니다. 빈 칸 / 요일 헤더 / 시간 헤더는 무시.
3. 한 블록에는 보통 [과목명, 강의실, (옵션)교수명] 정보가 적혀 있습니다. 가장 굵거나 큰 글자가 과목명, 그 외가 강의실/교수입니다.
4. 한 블록은 한 entry로 반환. 같은 과목이 월·수에 두 번 있으면 두 entry로 반환.
5. 시간은 24시간 형식 "HH:MM" (항상 2자리, 예: "09:00", "14:30").
6. 요일은 "MON"|"TUE"|"WED"|"THU"|"FRI"|"SAT"|"SUN" 중 하나.
7. 강의실(location)은 인식된 그대로. 인식 실패 또는 표기 없음이면 null.
8. 과목명은 한글/영문/숫자만, 분반 표기(예: "001", "분반A")가 함께 적혀 있으면 그대로 유지.

엉뚱한 이미지(시간표가 아닌 사진)면 빈 classes 배열을 반환하세요.`;
```

- [ ] **Step 2: Gemini 클라이언트 작성**

`src/lib/gemini/client.ts`:

```ts
import { GoogleGenAI, Type } from "@google/genai";
import { EVERYTIME_TIMETABLE_PROMPT } from "@/lib/gemini/prompts/everytime";
import type { ParsedClass } from "@/lib/everytime/types";

let cached: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY env var not set");
  if (!cached) cached = new GoogleGenAI({ apiKey: key });
  return cached;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    classes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          dayOfWeek: {
            type: Type.STRING,
            enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          },
          startTime: { type: Type.STRING, description: "HH:MM 24h, 항상 2자리" },
          endTime: { type: Type.STRING, description: "HH:MM 24h, 항상 2자리" },
          location: { type: Type.STRING, nullable: true },
        },
        required: ["title", "dayOfWeek", "startTime", "endTime"],
      },
    },
  },
  required: ["classes"],
};

type GeminiClassRaw = {
  title?: unknown;
  dayOfWeek?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  location?: unknown;
};

export class GeminiParseError extends Error {}

const TIME_RE = /^\d{2}:\d{2}$/;
const DOW = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

function isValidParsedClass(raw: GeminiClassRaw): raw is ParsedClass {
  return (
    typeof raw.title === "string" &&
    raw.title.trim().length > 0 &&
    typeof raw.dayOfWeek === "string" &&
    DOW.has(raw.dayOfWeek) &&
    typeof raw.startTime === "string" &&
    TIME_RE.test(raw.startTime) &&
    typeof raw.endTime === "string" &&
    TIME_RE.test(raw.endTime) &&
    raw.startTime < raw.endTime &&
    (raw.location === null || raw.location === undefined || typeof raw.location === "string")
  );
}

/**
 * 이미지 buffer를 Gemini 2.5 Flash로 보내 시간표 entry 배열로 파싱.
 * 응답이 schema에 안 맞거나 0개면 GeminiParseError throw.
 */
export async function parseTimetableImage(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedClass[]> {
  const client = getClient();
  const base64 = buffer.toString("base64");

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: EVERYTIME_TIMETABLE_PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new GeminiParseError("Gemini empty response");

  let parsed: { classes?: GeminiClassRaw[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiParseError("Gemini returned non-JSON");
  }

  if (!Array.isArray(parsed.classes)) {
    throw new GeminiParseError("missing classes array");
  }

  const valid = parsed.classes.filter(isValidParsedClass);
  if (valid.length === 0) {
    throw new GeminiParseError("no valid classes detected");
  }

  return valid.map((c) => ({
    title: c.title.trim(),
    dayOfWeek: c.dayOfWeek,
    startTime: c.startTime,
    endTime: c.endTime,
    location: c.location?.toString().trim() || null,
  }));
}
```

- [ ] **Step 3: PoC — 실제 스크린샷 1~2장으로 동작 확인**

이 단계는 일회성 검증이므로 코드 안 남기고 ad-hoc 스크립트로:

```bash
# 임시 ad-hoc 스크립트 (커밋 X)
node --experimental-vm-modules -e "
  import('./src/lib/gemini/client.ts').then(async ({ parseTimetableImage }) => {
    const fs = await import('node:fs');
    const buf = fs.readFileSync('./scratch/timetable-sample.jpg');
    const classes = await parseTimetableImage(buf, 'image/jpeg');
    console.log(JSON.stringify(classes, null, 2));
  });
"
```

또는 더 간단히, 스크래치 라우트를 임시로 만들어서 dev 서버 fetch로 확인.

검증 항목:
- enum이 'MON' 같은 정확한 형식으로 오는지 (`'mon'`, `'월'` 같은 변형 없음)
- startTime/endTime이 항상 "09:00" 같은 2자리 형식인지
- location이 null로 오는 경우 처리되는지

만약 enum이 깨지거나 시간 형식 변형이 자주 나오면, `client.ts`의 validation에서 자동으로 걸러지므로(invalid entry 제외) 기본 구현 그대로 OK. 검증 후 임시 파일/스크립트 삭제.

- [ ] **Step 4: typecheck**

```bash
pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini/client.ts src/lib/gemini/prompts/everytime.ts
git commit -m "feat(gemini): 시간표 OCR 클라이언트 + 프롬프트 + responseSchema"
```

---

## Task 7: /api/everytime/parse 라우트

**Files:**
- Create: `src/app/api/everytime/parse/route.ts`

- [ ] **Step 1: 라우트 작성**

`src/app/api/everytime/parse/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth";
import { parseTimetableImage, GeminiParseError } from "@/lib/gemini/client";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);
const MAX_CLASSES = 30;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json({ error: "5MB 이하 이미지만 지원해요" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "이미지가 없어요" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "jpg/png 이미지만 지원해요" }, { status: 415 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "5MB 이하 이미지만 지원해요" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const classes = await parseTimetableImage(buffer, file.type);

    if (classes.length > MAX_CLASSES) {
      return NextResponse.json(
        { error: "시간표가 아닌 이미지로 보여요" },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: { classes } });
  } catch (err) {
    if (err instanceof GeminiParseError) {
      return NextResponse.json(
        { error: "시간표를 인식할 수 없었어요. 더 선명한 사진으로 다시 시도해주세요" },
        { status: 422 }
      );
    }
    console.error("[/api/everytime/parse] Gemini call failed:", err);
    return NextResponse.json(
      { error: "OCR 서버에 일시적인 문제가 있어요" },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 3: 수동 동작 확인 (선택)**

dev 서버 켜고 curl로:

```bash
pnpm dev
# 다른 터미널에서
curl -X POST http://localhost:3000/api/everytime/parse \
  -F "image=@scratch/timetable-sample.jpg" \
  --cookie "..."  # 로그인 쿠키
```

Expected: `200` + classes 배열, 또는 422/502 에러 메시지.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/everytime/parse/route.ts
git commit -m "feat(api): /api/everytime/parse — 이미지 검증 + Gemini 호출"
```

---

## Task 8: /api/everytime/import 라우트 (POST + DELETE)

**Files:**
- Create: `src/app/api/everytime/import/route.ts`

- [ ] **Step 1: 라우트 작성**

`src/app/api/everytime/import/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { expandClasses } from "@/lib/everytime/expand";
import { DAYS_OF_WEEK, type ParsedClass } from "@/lib/everytime/types";

const MAX_CLASSES = 30;
const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ImportRequest = {
  classes: ParsedClass[];
  semesterStart: string;
  semesterEnd: string;
};

function validate(body: ImportRequest): string | null {
  if (!Array.isArray(body.classes) || body.classes.length === 0) {
    return "classes가 비어있어요";
  }
  if (body.classes.length > MAX_CLASSES) {
    return "한 번에 30개 이하만 추가할 수 있어요";
  }
  if (!DATE_RE.test(body.semesterStart) || !DATE_RE.test(body.semesterEnd)) {
    return "학기 날짜 형식이 올바르지 않아요";
  }
  if (body.semesterStart > body.semesterEnd) {
    return "학기 종료일이 시작일보다 빨라요";
  }
  for (const c of body.classes) {
    if (!c.title || c.title.trim().length === 0) return "과목명이 비어있어요";
    if (!DAYS_OF_WEEK.includes(c.dayOfWeek)) return "요일 형식이 올바르지 않아요";
    if (!TIME_RE.test(c.startTime) || !TIME_RE.test(c.endTime)) {
      return "시간 형식이 올바르지 않아요";
    }
    if (c.startTime >= c.endTime) return "종료 시간은 시작 시간보다 늦어야 해요";
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: ImportRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    const status = body.classes?.length > MAX_CLASSES ? 422 : 400;
    return NextResponse.json({ error: validationError }, { status });
  }

  const rows = expandClasses({
    classes: body.classes,
    semesterStart: body.semesterStart,
    semesterEnd: body.semesterEnd,
  });

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("replace_everytime_schedules", {
    p_user_id: user.id,
    p_payloads: rows,
  });

  if (error) {
    console.error("[/api/everytime/import] RPC failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      insertedCount: data ?? 0,
      classCount: body.classes.length,
    },
  });
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("schedules")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .eq("source", "everytime");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { deletedCount: count ?? 0 } });
}
```

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

Expected: 에러 없음. 만약 `supabase.rpc("replace_everytime_schedules", ...)`에서 타입 에러 나면 Task 1의 `pnpm db:types`가 안 돌았다는 뜻. 다시 실행.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/everytime/import/route.ts
git commit -m "feat(api): /api/everytime/import — RPC 호출 + DELETE 엔드포인트"
```

---

## Task 9: EverytimeImportSheet 컴포넌트 (4-step UI)

**Files:**
- Create: `src/components/calendar/EverytimeImportSheet.tsx`

200줄 초과 가능성이 높으므로, 길어지면 step 컴포넌트로 분리. 우선 한 파일에 작성.

- [ ] **Step 1: 시트 컴포넌트 작성**

`src/components/calendar/EverytimeImportSheet.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  SEMESTER_PRESETS,
  getDefaultSemesterPreset,
  type SemesterPreset,
} from "@/lib/everytime/constants";
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type ParsedClass,
} from "@/lib/everytime/types";

type Step = "upload" | "analyzing" | "preview" | "saving";

type PreviewItem = ParsedClass & {
  checked: boolean;
  flag: "missing_title" | "invalid_day" | "invalid_time" | "end_before_start" | null;
};

const DAY_LABEL: Record<DayOfWeek, string> = {
  MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토", SUN: "일",
};

const MAX_BYTES = 5 * 1024 * 1024;
const TIME_RE = /^\d{2}:\d{2}$/;

function flagOf(c: ParsedClass): PreviewItem["flag"] {
  if (!c.title.trim()) return "missing_title";
  if (!DAYS_OF_WEEK.includes(c.dayOfWeek)) return "invalid_day";
  if (!TIME_RE.test(c.startTime) || !TIME_RE.test(c.endTime)) return "invalid_time";
  if (c.startTime >= c.endTime) return "end_before_start";
  return null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  hasExistingEverytime: boolean;
  existingCount: number;
};

export function EverytimeImportSheet({ open, onClose, hasExistingEverytime, existingCount }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [presetId, setPresetId] = useState<SemesterPreset["id"] | "custom">(
    getDefaultSemesterPreset(new Date()).id
  );
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 시트 열릴 때마다 step 초기화
  useEffect(() => {
    if (open) {
      setStep("upload");
      setItems([]);
      setError(null);
    } else {
      abortRef.current?.abort();
    }
  }, [open]);

  function resolveSemesterRange(): { start: string; end: string } | null {
    if (presetId === "custom") {
      if (!customStart || !customEnd) return null;
      return { start: customStart, end: customEnd };
    }
    const p = SEMESTER_PRESETS.find((x) => x.id === presetId)!;
    return { start: p.start, end: p.end };
  }

  async function handleFileSelected(file: File) {
    setError(null);

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("jpg/png 이미지만 지원해요");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("5MB 이하 이미지만 지원해요");
      return;
    }

    setStep("analyzing");
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/everytime/parse", {
        method: "POST",
        body: fd,
        signal: ac.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "시간표를 인식할 수 없었어요");
        setStep("upload");
        return;
      }

      const { data } = (await res.json()) as { data: { classes: ParsedClass[] } };
      const previewItems: PreviewItem[] = data.classes.map((c) => {
        const flag = flagOf(c);
        return { ...c, checked: flag === null, flag };
      });
      setItems(previewItems);
      setStep("preview");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStep("upload");
        return;
      }
      setError("네트워크 오류가 발생했어요");
      setStep("upload");
    }
  }

  function updateItem(index: number, patch: Partial<ParsedClass>) {
    setItems((prev) => {
      const next = [...prev];
      const merged = { ...next[index], ...patch };
      next[index] = { ...merged, flag: flagOf(merged), checked: merged.checked && flagOf(merged) === null };
      return next;
    });
  }

  function toggleItem(index: number) {
    setItems((prev) => {
      const next = [...prev];
      const it = next[index];
      if (it.flag !== null) return prev;
      next[index] = { ...it, checked: !it.checked };
      return next;
    });
  }

  async function handleImport() {
    setError(null);
    const range = resolveSemesterRange();
    if (!range) {
      setError("학기 날짜를 선택해 주세요");
      return;
    }
    if (range.start > range.end) {
      setError("학기 종료일이 시작일보다 빨라요");
      return;
    }

    const selected = items
      .filter((it) => it.checked && it.flag === null)
      .map<ParsedClass>(({ title, dayOfWeek, startTime, endTime, location }) => ({
        title: title.trim(),
        dayOfWeek,
        startTime,
        endTime,
        location: location?.trim() || null,
      }));

    if (selected.length === 0) {
      setError("추가할 수업이 없어요");
      return;
    }

    setStep("saving");
    try {
      const res = await fetch("/api/everytime/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classes: selected,
          semesterStart: range.start,
          semesterEnd: range.end,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "저장에 실패했어요");
        setStep("preview");
        return;
      }

      const { data } = (await res.json()) as {
        data: { insertedCount: number; classCount: number };
      };
      onClose();
      router.refresh();
      // 토스트는 간단히 alert로 (디자인 시스템에 토스트 컴포넌트 없으면)
      alert(`${data.classCount}개 수업이 학기 동안 추가됐어요`);
    } catch {
      setError("네트워크 오류가 발생했어요");
      setStep("preview");
    }
  }

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90dvh] overflow-y-auto p-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-gray-100 dark:border-gray-700">
          <SheetTitle className="text-base font-semibold text-gray-800 dark:text-gray-100">
            에브리타임 시간표 가져오기
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {step === "upload" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  학기
                </label>
                <div className="flex flex-col gap-2">
                  {SEMESTER_PRESETS.map((p) => (
                    <label key={p.id} className="flex items-center min-h-11 gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="preset"
                        checked={presetId === p.id}
                        onChange={() => setPresetId(p.id)}
                        className="h-5 w-5 accent-violet-600"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-100">
                        {p.label}
                        <span className="text-gray-400 ml-2">{p.start} ~ {p.end}</span>
                      </span>
                    </label>
                  ))}
                  <label className="flex items-center min-h-11 gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="preset"
                      checked={presetId === "custom"}
                      onChange={() => setPresetId("custom")}
                      className="h-5 w-5 accent-violet-600"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-100">직접 선택</span>
                  </label>
                  {presetId === "custom" && (
                    <div className="grid grid-cols-2 gap-2 pl-7">
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                      />
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="everytime-image"
                  className="flex flex-col items-center justify-center min-h-32 px-4 py-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    시간표 스크린샷 선택
                  </span>
                  <span className="text-xs text-gray-400 mt-1">jpg / png · 5MB 이하</span>
                </label>
                <input
                  id="everytime-image"
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileSelected(f);
                    e.target.value = "";
                  }}
                />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </>
          )}

          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-700 dark:text-gray-200">시간표 읽는 중…</p>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="text-xs text-gray-400 underline min-h-11 px-2"
              >
                취소
              </button>
            </div>
          )}

          {step === "preview" && (
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
                        onChange={() => toggleItem(idx)}
                        className="h-5 w-5 accent-violet-600 disabled:opacity-40"
                      />
                      <input
                        type="text"
                        value={it.title}
                        onChange={(e) => updateItem(idx, { title: e.target.value })}
                        className="flex-1 min-w-0 h-9 px-2 text-sm rounded border border-transparent focus:border-violet-500 focus:outline-none bg-transparent text-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <div className="grid grid-cols-[40px_1fr_1fr] gap-2 mt-1.5 pl-7">
                      <select
                        value={it.dayOfWeek}
                        onChange={(e) => updateItem(idx, { dayOfWeek: e.target.value as DayOfWeek })}
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
                        onChange={(e) => updateItem(idx, { startTime: e.target.value })}
                        className="h-9 px-2 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                      />
                      <input
                        type="time"
                        step={1800}
                        value={it.endTime}
                        onChange={(e) => updateItem(idx, { endTime: e.target.value })}
                        className="h-9 px-2 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                      />
                    </div>
                    <input
                      type="text"
                      value={it.location ?? ""}
                      onChange={(e) => updateItem(idx, { location: e.target.value || null })}
                      placeholder="(장소 선택)"
                      className="mt-1.5 ml-7 w-[calc(100%-1.75rem)] h-9 px-2 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 placeholder:text-gray-400"
                    />
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={checkedCount === 0}
                >
                  {checkedCount}개 추가
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  취소
                </Button>
              </div>
            </>
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-700 dark:text-gray-200">저장 중…</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: 파일 줄 수 확인**

```bash
wc -l src/components/calendar/EverytimeImportSheet.tsx
```

Expected: 250줄 정도. CLAUDE.md의 200줄 룰을 약간 초과 — 실용적 분리가 가능하면 step 컴포넌트로 쪼갠다 (`EverytimeUploadStep.tsx`, `EverytimePreviewStep.tsx`). 그게 부담스러우면 200줄 룰 위반에 대한 코멘트 한 줄 첨부 + commit. (실용성 우선)

만약 분리한다면:
- `EverytimeUploadStep.tsx`: upload step JSX (학기 라디오 + 파일 input)
- `EverytimePreviewStep.tsx`: preview step JSX (리스트 + 추가 버튼)
- `EverytimeImportSheet.tsx`: state 관리 + 분기

- [ ] **Step 3: typecheck**

```bash
pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/EverytimeImportSheet.tsx
git commit -m "feat(everytime): EverytimeImportSheet 4-step (upload/analyzing/preview/saving)"
```

---

## Task 10: EverytimeImportButton + 홈 페이지 통합

**Files:**
- Create: `src/components/calendar/EverytimeImportButton.tsx`
- Modify: `src/app/(main)/home/page.tsx`

- [ ] **Step 1: 진입 버튼 작성**

`src/components/calendar/EverytimeImportButton.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EverytimeImportSheet } from "@/components/calendar/EverytimeImportSheet";

type Props = {
  hasExistingEverytime: boolean;
  existingCount: number;
};

export function EverytimeImportButton({ hasExistingEverytime, existingCount }: Props) {
  const [open, setOpen] = useState(false);
  const label = hasExistingEverytime
    ? "에브리타임 시간표 다시 가져오기"
    : "에브리타임 시간표 가져오기";

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <EverytimeImportSheet
        open={open}
        onClose={() => setOpen(false)}
        hasExistingEverytime={hasExistingEverytime}
        existingCount={existingCount}
      />
    </>
  );
}
```

- [ ] **Step 2: 홈 페이지에 통합**

`src/app/(main)/home/page.tsx`를 다음과 같이 수정:

기존 import에 추가:

```tsx
import { EverytimeImportButton } from "@/components/calendar/EverytimeImportButton";
import { GoogleConnectButton } from "@/components/calendar/GoogleConnectButton";
```

(만약 `GoogleConnectButton` import가 이미 있으면 두 번 안 적음)

`schedules` 계산 직후, `everytime` count 계산 추가:

```tsx
const everytimeCount = (schedulesData ?? []).filter((s) => s.source === "everytime").length;
const hasEverytime = everytimeCount > 0;
```

JSX의 헤더 영역(`<AddPersonalScheduleButton />` 위 또는 아래)에 진입 버튼 추가. 단, 헤더는 이미 컴팩트하니 `ReauthBanner` 아래쯤에 별도 줄로:

```tsx
<ReauthBanner needsReauth={needsReauth} />
{syncedAt && (
  <div className="px-5 pt-1">
    <GoogleSyncIndicator syncedAt={syncedAt} />
  </div>
)}
<div className="px-5 pt-2 flex flex-col gap-2">
  <GoogleConnectButton connectedEmail={userInfo?.google_calendar_email ?? null} />
  <EverytimeImportButton
    hasExistingEverytime={hasEverytime}
    existingCount={everytimeCount}
  />
</div>
```

(현재 `GoogleConnectButton`이 어디서 호출되는지 확인 필요. 만약 다른 곳에서 호출 중이면 그 옆에 `EverytimeImportButton`만 추가하고, 아니면 위처럼 새 섹션 만듦.)

- [ ] **Step 3: 빌드 확인**

```bash
pnpm typecheck
pnpm lint
```

Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/EverytimeImportButton.tsx src/app/(main)/home/page.tsx
git commit -m "feat(everytime): 홈 헤더에 진입 버튼 + hasExisting prop 전달"
```

---

## Task 11: 시연 시나리오 수동 QA + 최종 검증

**Files:** 없음 (수동 검증)

- [ ] **Step 1: 전체 테스트 + lint + typecheck**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: 모두 통과. 실패하면 fix하고 다시.

- [ ] **Step 2: dev 서버 시연 시나리오**

```bash
pnpm dev
```

브라우저(`http://localhost:3000`)에서:

1. 카카오 로그인 후 홈 진입
2. "에브리타임 시간표 가져오기" 버튼 탭 → 시트 열림
3. 학기 = 1학기 (자동 디폴트) 확인
4. 시간표 스크린샷 1장 업로드 → "시간표 읽는 중…" 로딩
5. preview 화면에서 5~6개 과목 검출 확인
   - 한 과목 체크 해제 → 카운터 감소 확인
   - 한 과목의 시간 인라인 수정 → flag 사라지는지 확인
6. "X개 추가" 탭 → 시트 닫힘 + alert
7. 캘린더에서 매주 같은 요일에 일정 표시되는지 확인
8. 다시 "에브리타임 시간표 다시 가져오기" 라벨로 바뀐 진입 버튼 탭
9. 새 스크린샷 업로드 → preview 상단에 "기존 N개가 교체됩니다" amber 안내 보이는지
10. 저장 후 기존 일정이 새 일정으로 완전히 대체됐는지 확인

- [ ] **Step 3: 에러 시나리오 확인**

- 6MB 이미지 업로드 → 클라이언트 토스트 차단
- 시간표가 아닌 random 이미지 업로드 → "시간표를 인식할 수 없었어요" 토스트
- 분석 중 "취소" 탭 → upload step으로 복귀

- [ ] **Step 4: Commit (있다면)**

수동 QA에서 발견한 버그를 수정한 경우만 commit. 시나리오가 깨끗하게 통과했으면 commit 없음.

```bash
git status
# 변경된 게 있으면
git add ...
git commit -m "fix(everytime): QA 발견 이슈 수정"
```

- [ ] **Step 5: PR 또는 finishing-a-development-branch 스킬 호출**

작업이 끝났다는 신호. 사용자에게 finishing 단계로 넘어갈지 확인하고, 동의하면 `superpowers:finishing-a-development-branch` 스킬 사용.

---

## Self-Review (작성자가 plan 완료 직후 점검)

- [x] **Spec coverage**: spec의 모든 결정 사항이 task로 매핑됨
  - 인식 엔진 → Task 6
  - 반복 일정 모델 (그룹핑) → Task 5
  - 학기 범위 입력 → Task 0, 3, 9
  - 재업로드 정책 (RPC) → Task 1, 8
  - 미리보기/편집 → Task 9
  - 충돌 처리 → 별도 처리 X (그냥 추가) — Task 8 RPC가 자연스럽게 처리
  - 오류 처리 (415/413/422/502) → Task 7
  - sanity cap (30개) → Task 7, 8
  - 더블클릭 race → Task 9 (`disabled` 처리)
  - dayOfWeek enum 강제 → Task 6
  - AbortController → Task 9
  - "기존 N개 교체" 안내 → Task 9, 10
  - PoC → Task 6 step 3
- [x] **Placeholder scan**: TBD/TODO/"적절히" 등 없음
- [x] **Type consistency**: `ParsedClass`, `ExpandedRow`, `DayOfWeek` 모두 Task 4에 정의 후 일관 사용
- [x] **빠진 검증**: spec 11번 "Gemini responseSchema PoC"는 Task 6 Step 3에 ad-hoc 검증으로 포함

---

**완료 조건:** Task 11 시연 시나리오 1~10이 끊김 없이 동작.
