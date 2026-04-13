# 모임 만들기 화면 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/create` 탭의 플레이스홀더를 완성된 모임 생성 폼으로 교체한다.

**Architecture:** 서버 컴포넌트(`create/page.tsx`)가 친구 목록을 Supabase에서 조회해 클라이언트 폼(`CreateMeetingForm`)에 전달한다. 폼은 `POST /api/groups` → `POST /api/vote-sessions` 순으로 호출 후 `/group/[id]`로 이동한다. 날짜 선택은 `CandidateDatePicker`(인라인 미니 캘린더), 참여자 선택은 `MemberSelector`(아바타 가로 스크롤)로 분리한다.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · date-fns · Vitest · Framer Motion

---

## 파일 구조

| 경로 | 역할 |
|------|------|
| `src/app/(main)/create/page.tsx` | 서버 컴포넌트 — 친구 목록 조회 후 폼에 전달 |
| `src/components/create/CreateMeetingForm.tsx` | 클라이언트 — 전체 폼 상태·제출 처리 |
| `src/components/create/MemberSelector.tsx` | 클라이언트 — 아바타 가로 스크롤 + 선택 칩 |
| `src/components/create/CandidateDatePicker.tsx` | 클라이언트 — 인라인 미니 캘린더(멀티 선택) |
| `src/lib/candidate-dates.ts` | 순수 함수 — 날짜 토글·과거 판별·포맷 (테스트 용이) |
| `src/test/candidate-dates.test.ts` | Vitest 단위 테스트 |

---

## Task 1: 날짜 유틸 함수 + 테스트

**Files:**
- Create: `src/lib/candidate-dates.ts`
- Create: `src/test/candidate-dates.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// src/test/candidate-dates.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  toggleCandidateDate,
  isPastDate,
  formatCandidateChip,
} from "@/lib/candidate-dates";

describe("toggleCandidateDate", () => {
  it("날짜가 없으면 추가한다", () => {
    expect(toggleCandidateDate([], "2026-05-01")).toEqual(["2026-05-01"]);
  });

  it("이미 있는 날짜는 제거한다", () => {
    expect(
      toggleCandidateDate(["2026-05-01", "2026-05-02"], "2026-05-01")
    ).toEqual(["2026-05-02"]);
  });

  it("없는 날짜는 정렬하여 추가한다", () => {
    expect(
      toggleCandidateDate(["2026-05-03"], "2026-05-01")
    ).toEqual(["2026-05-01", "2026-05-03"]);
  });
});

describe("isPastDate", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-14"));
  });

  it("오늘은 과거가 아니다", () => {
    expect(isPastDate(new Date("2026-04-14"))).toBe(false);
  });

  it("어제는 과거다", () => {
    expect(isPastDate(new Date("2026-04-13"))).toBe(true);
  });

  it("내일은 과거가 아니다", () => {
    expect(isPastDate(new Date("2026-04-15"))).toBe(false);
  });
});

describe("formatCandidateChip", () => {
  it('"2026-05-01" → "5월 1일 금"', () => {
    expect(formatCandidateChip("2026-05-01")).toBe("5월 1일 금");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm test src/test/candidate-dates.test.ts
```

Expected: FAIL (모듈 없음)

- [ ] **Step 3: 유틸 함수 구현**

```typescript
// src/lib/candidate-dates.ts
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
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
pnpm test src/test/candidate-dates.test.ts
```

Expected: 6개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/candidate-dates.ts src/test/candidate-dates.test.ts
git commit -m "feat: candidate-dates 유틸 함수 + 테스트"
```

---

## Task 2: CandidateDatePicker 컴포넌트

**Files:**
- Create: `src/components/create/CandidateDatePicker.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`MonthlyCalendar`와 동일한 캘린더 패턴(헤더·요일·그리드)을 사용하되, 멀티 선택 + 과거 비활성 동작을 추가한다.

```typescript
// src/components/create/CandidateDatePicker.tsx
"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  subMonths,
  formatMonthYear,
  getCalendarDays,
  isSameDay,
} from "@/lib/date";
import { toggleCandidateDate, isPastDate, formatCandidateChip } from "@/lib/candidate-dates";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type CandidateDatePickerProps = {
  selected: string[]; // "YYYY-MM-DD" 배열
  onChange: (dates: string[]) => void;
};

export function CandidateDatePicker({ selected, onChange }: CandidateDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const days = getCalendarDays(currentMonth);

  const handleDayClick = (day: Date) => {
    if (isPastDate(day)) return;
    const dateStr = format(day, "yyyy-MM-dd");
    onChange(toggleCandidateDate(selected, dateStr));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* 월 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <button
          aria-label="이전 달"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 active:scale-95 transition-all text-gray-500 dark:text-gray-400"
        >
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {formatMonthYear(currentMonth)}
        </span>
        <button
          aria-label="다음 달"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 active:scale-95 transition-all text-gray-500 dark:text-gray-400"
        >
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      </div>

      <div className="px-4 pb-4">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mt-3">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="h-px bg-gray-100 dark:bg-gray-700 mb-1" />

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateStr = format(day, "yyyy-MM-dd");
            const isSelected = selected.includes(dateStr);
            const isPast = isPastDate(day);

            return (
              <button
                key={idx}
                onClick={() => handleDayClick(day)}
                disabled={isPast}
                aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일${isSelected ? " 선택됨" : ""}`}
                aria-pressed={isSelected}
                className={cn(
                  "flex flex-col items-center py-1.5 min-h-11 justify-center",
                  isPast && "opacity-30 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "font-serif w-8 h-8 flex items-center justify-center text-sm rounded-full transition-all",
                    isSelected
                      ? "bg-violet-600 text-white shadow-[0_2px_6px_rgba(124,58,237,0.3)]"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* 선택 날짜 칩 요약 */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            {selected.map((d) => (
              <button
                key={d}
                onClick={() => onChange(toggleCandidateDate(selected, d))}
                aria-label={`${formatCandidateChip(d)} 선택 해제`}
                className="flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 text-xs rounded-full px-3 py-1 font-medium"
              >
                {formatCandidateChip(d)}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/create/CandidateDatePicker.tsx
git commit -m "feat: CandidateDatePicker 인라인 멀티 선택 캘린더"
```

---

## Task 3: MemberSelector 컴포넌트

**Files:**
- Create: `src/components/create/MemberSelector.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
// src/components/create/MemberSelector.tsx
"use client";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type MemberSelectorProps = {
  friends: User[];
  selected: string[]; // userId 배열
  onChange: (ids: string[]) => void;
};

export function MemberSelector({ friends, selected, onChange }: MemberSelectorProps) {
  const toggle = (userId: string) => {
    if (selected.includes(userId)) {
      onChange(selected.filter((id) => id !== userId));
    } else {
      onChange([...selected, userId]);
    }
  };

  if (friends.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
        아직 친구가 없어요.{" "}
        <span className="text-violet-600 dark:text-violet-400">친구 탭</span>에서 먼저 추가해보세요.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 선택된 친구 칩 */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const user = friends.find((f) => f.id === id);
            if (!user) return null;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                aria-label={`${user.nickname} 선택 해제`}
                className="flex items-center gap-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-full pl-1 pr-3 py-1"
              >
                <Avatar user={user} size="sm" />
                <span className="text-xs font-medium text-violet-800 dark:text-violet-300">
                  {user.nickname}
                </span>
                <span aria-hidden className="text-violet-500 text-xs ml-0.5">×</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 아바타 가로 스크롤 */}
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        {friends.map((user) => {
          const isSelected = selected.includes(user.id);
          return (
            <button
              key={user.id}
              onClick={() => toggle(user.id)}
              aria-label={`${user.nickname} ${isSelected ? "선택 해제" : "선택"}`}
              aria-pressed={isSelected}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[52px]"
            >
              <div
                className={cn(
                  "transition-all",
                  isSelected && "ring-2 ring-violet-600 ring-offset-2 rounded-full"
                )}
              >
                <Avatar user={user} size="md" />
              </div>
              <span
                className={cn(
                  "text-xs truncate max-w-[52px]",
                  isSelected
                    ? "text-violet-600 dark:text-violet-400 font-medium"
                    : "text-gray-600 dark:text-gray-400"
                )}
              >
                {user.nickname}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 인라인 아바타 헬퍼 ──────────────────────────────────────────
// size: "sm" = 22px (칩용), "md" = 44px (스크롤 목록용)
type AvatarSize = "sm" | "md";

const AVATAR_SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "w-[22px] h-[22px] text-[9px]",
  md: "w-11 h-11 text-base",
};

function Avatar({ user, size }: { user: User; size: AvatarSize }) {
  const initials = user.nickname.slice(0, 1);
  const colors = [
    "bg-violet-500",
    "bg-violet-400",
    "bg-violet-300 text-violet-800",
    "bg-gray-400",
    "bg-gray-300 text-gray-700",
  ];
  const colorClass = colors[user.id.charCodeAt(0) % colors.length];
  const sizeClass = AVATAR_SIZE_CLASS[size];

  if (user.profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.profileImageUrl}
        alt={user.nickname}
        className={cn("rounded-full object-cover", sizeClass)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold",
        sizeClass,
        colorClass
      )}
    >
      {initials}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/create/MemberSelector.tsx
git commit -m "feat: MemberSelector 아바타 멀티 선택 컴포넌트"
```

---

## Task 4: CreateMeetingForm 클라이언트 컴포넌트

**Files:**
- Create: `src/components/create/CreateMeetingForm.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
// src/components/create/CreateMeetingForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MemberSelector } from "@/components/create/MemberSelector";
import { CandidateDatePicker } from "@/components/create/CandidateDatePicker";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type CreateMeetingFormProps = {
  friends: User[];
};

export function CreateMeetingForm({ friends }: CreateMeetingFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [candidateDates, setCandidateDates] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim().length > 0 && candidateDates.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    try {
      // 1. 그룹 생성
      const groupRes = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), memberIds }),
      });

      if (!groupRes.ok) {
        const body: { error?: string } = await groupRes.json();
        throw new Error(body.error ?? "그룹 생성에 실패했어요");
      }

      const { data: group }: { data: { id: string } } = await groupRes.json();

      // 2. 투표 세션 생성
      const sessionRes = await fetch("/api/vote-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.id,
          candidateDates,
          deadline: deadline || null,
        }),
      });

      if (!sessionRes.ok) {
        const body: { error?: string } = await sessionRes.json();
        throw new Error(body.error ?? "투표 세션 생성에 실패했어요");
      }

      router.push(`/group/${group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요");
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-5 py-6 space-y-5"
    >
      {/* 모임 이름 */}
      <div>
        <label
          htmlFor="meeting-name"
          className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
        >
          모임 이름 <span className="text-violet-600">*</span>
        </label>
        <input
          id="meeting-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 여름 치맥 번개"
          maxLength={30}
          className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white dark:focus:bg-gray-700 transition-all"
        />
      </div>

      {/* 참여자 선택 */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          참여자 선택{" "}
          <span className="text-xs font-normal text-gray-400">(본인 자동 포함)</span>
        </p>
        <MemberSelector
          friends={friends}
          selected={memberIds}
          onChange={setMemberIds}
        />
      </div>

      {/* 후보 날짜 */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          후보 날짜 <span className="text-violet-600">*</span>{" "}
          <span className="text-xs font-normal text-gray-400">여러 날 선택 가능</span>
        </p>
        <CandidateDatePicker
          selected={candidateDates}
          onChange={setCandidateDates}
        />
      </div>

      {/* 투표 마감일 (선택) */}
      <div>
        <label
          htmlFor="deadline"
          className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
        >
          투표 마감일{" "}
          <span className="text-xs font-normal text-gray-400">선택</span>
        </label>
        <input
          id="deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white dark:focus:bg-gray-700 transition-all"
        />
      </div>

      {/* 에러 */}
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* CTA */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          "w-full h-[52px] rounded-xl text-base font-semibold text-white transition-all active:scale-[0.97]",
          canSubmit
            ? "bg-violet-600 hover:bg-violet-700"
            : "bg-violet-600 opacity-40 cursor-not-allowed"
        )}
      >
        {submitting ? "만드는 중..." : "모임 만들고 투표 시작"}
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 2: 타입체크**

```bash
pnpm typecheck
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/create/CreateMeetingForm.tsx
git commit -m "feat: CreateMeetingForm 폼 상태·제출 클라이언트 컴포넌트"
```

---

## Task 5: create/page.tsx 서버 컴포넌트 교체

**Files:**
- Modify: `src/app/(main)/create/page.tsx`

- [ ] **Step 1: 페이지 교체**

```typescript
// src/app/(main)/create/page.tsx
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { mapUser } from "@/lib/mappers";
import { CreateMeetingForm } from "@/components/create/CreateMeetingForm";
import type { User } from "@/types";

export default async function CreatePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  // 수락된 친구 id 수집
  const [{ data: sent }, { data: received }] = await Promise.all([
    supabase
      .from("friendships")
      .select("receiver_id")
      .eq("requester_id", user.id)
      .eq("status", "accepted"),
    supabase
      .from("friendships")
      .select("requester_id")
      .eq("receiver_id", user.id)
      .eq("status", "accepted"),
  ]);

  const friendIds = [
    ...(sent ?? []).map((f) => f.receiver_id),
    ...(received ?? []).map((f) => f.requester_id),
  ];

  let friends: User[] = [];
  if (friendIds.length > 0) {
    const { data: usersData } = await supabase
      .from("users")
      .select("*")
      .in("id", friendIds);
    friends = (usersData ?? []).map(mapUser);
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-dvh">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 pt-5 pb-4">
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-gray-100">
          모임 만들기
        </h1>
      </div>

      <CreateMeetingForm friends={friends} />
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 린트**

```bash
pnpm typecheck && pnpm lint
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/app/(main)/create/page.tsx
git commit -m "feat: 모임 만들기 화면 완성 (서버 컴포넌트 + 친구 목록 조회)"
```

---

## Task 6: 수동 동작 검증

- [ ] **Step 1: 개발 서버 실행**

```bash
pnpm dev
```

- [ ] **Step 2: 체크리스트**

브라우저에서 `http://localhost:3000` 접속 후 확인:

| 항목 | 확인 |
|------|------|
| 하단 탭 "+" 탭 시 모임 만들기 화면 노출 | |
| 모임 이름 비어있을 때 CTA 버튼 비활성(opacity 낮음) | |
| 후보 날짜 0개일 때 CTA 버튼 비활성 | |
| 날짜 탭 → 선택(보라 원) / 재탭 → 해제 | |
| 캘린더 하단 칩 표시 / 칩 × 탭 → 해제 | |
| 과거 날짜 탭 → 반응 없음(비활성) | |
| 친구 아바타 탭 → 선택(ring) + 상단 칩 등장 | |
| CTA 탭 → "만드는 중..." 표시 후 `/group/[id]` 이동 | |
| 친구 0명일 때 안내 문구 표시 | |
| 다크 모드 전환 시 레이아웃 깨짐 없음 | |

- [ ] **Step 3: 전체 테스트 + 빌드**

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Expected: 모두 통과

- [ ] **Step 4: 최종 커밋 (변경사항 있을 경우)**

```bash
git add -p
git commit -m "fix: 모임 만들기 화면 검증 후 수정사항 반영"
```
