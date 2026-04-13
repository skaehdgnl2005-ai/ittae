# Phase 1 프론트엔드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js 14 앱 초기화부터 홈·친구/그룹·투표·지도·기록 5개 화면까지 목업 데이터 기반 프론트엔드 완성.

**Architecture:** App Router 서버 컴포넌트 기본, 인터랙션 필요 시만 `"use client"`. 5개 화면은 TASKS.md 순서대로 구현하고 각 화면 완료 후 `/design-check` 통과 필수. 목업 데이터는 `src/lib/mock/index.ts`에 집중하여 Phase 2에서 Supabase 교체 최소화.

**Tech Stack:** Next.js 14 · TypeScript · Tailwind CSS (커스텀 팔레트) · shadcn/ui · Framer Motion · date-fns · Vitest + Testing Library · Lucide Icons

---

## 파일 구조

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx                        # 루트 레이아웃 (폰트, 메타)
│   ├── (main)/
│   │   ├── layout.tsx                    # BottomTabNav 래핑
│   │   ├── home/page.tsx
│   │   ├── friends/page.tsx
│   │   ├── create/page.tsx               # 모임 생성 진입점 (Phase 1: 기본 UI)
│   │   ├── map/page.tsx
│   │   └── history/page.tsx
│   └── group/[id]/page.tsx               # 투표 화면
├── components/
│   ├── ui/
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   └── Button.tsx
│   ├── layout/
│   │   └── BottomTabNav.tsx
│   ├── calendar/
│   │   ├── MonthlyCalendar.tsx
│   │   ├── DayEventList.tsx
│   │   └── TodaySummaryCard.tsx
│   ├── friends/
│   │   ├── FriendList.tsx
│   │   ├── GroupCard.tsx
│   │   └── FilterChip.tsx
│   ├── vote/
│   │   ├── VoteMatrix.tsx
│   │   ├── VoteCell.tsx
│   │   ├── BestDateBanner.tsx
│   │   ├── StickyConfirmButton.tsx
│   │   └── CommentSection.tsx
│   ├── map/
│   │   ├── KakaoMapProvider.tsx
│   │   ├── MapView.tsx
│   │   ├── RadiusSlider.tsx
│   │   ├── CategoryFilterBar.tsx
│   │   └── PlaceCardCarousel.tsx
│   └── history/
│       ├── TimelineView.tsx
│       ├── MemoryCard.tsx
│       └── StatsSummary.tsx
├── lib/
│   ├── utils.ts                          # cn()
│   ├── date.ts                           # date-fns 헬퍼
│   ├── vote.ts                           # 투표 집계 로직
│   └── mock/
│       └── index.ts
└── types/
    └── index.ts
```

---

## Task 1: 프로젝트 초기화

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts` (create-next-app)
- Modify: `package.json` (typecheck 스크립트 추가)

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
cd "c:/Users/skaeh/Downloads/moim-harness/harness"
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
```

Expected: `✓ Created a new Next.js app in .`  
`--yes`로 모든 프롬프트 자동 수락. 기존 파일(CLAUDE.md, docs/, .claude/)은 덮어쓰지 않음.

- [ ] **Step 2: 추가 의존성 설치**

```bash
pnpm add framer-motion date-fns clsx tailwind-merge lucide-react
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: shadcn/ui 초기화**

```bash
pnpm dlx shadcn@latest init --yes --base-color slate
pnpm dlx shadcn@latest add sheet input scroll-area
```

- [ ] **Step 4: typecheck 스크립트 추가**

`package.json`의 `scripts`에 추가:

```json
"typecheck": "tsc --noEmit",
"test": "vitest"
```

- [ ] **Step 5: 동작 확인**

```bash
pnpm dev
```

Expected: `http://localhost:3000` 기본 Next.js 페이지 정상 표시.

- [ ] **Step 6: 커밋**

```bash
git init
git add -A
git commit -m "chore: Next.js 14 프로젝트 초기화"
```

---

## Task 2: Vitest 설정

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: vitest.config.ts 작성**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 2: 테스트 setup 파일 작성**

```typescript
// src/test/setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 3: 동작 확인 (플레이스홀더 테스트)**

```bash
pnpm test --run
```

Expected: `0 tests passed` (아직 테스트 없음, 에러 없이 종료).

- [ ] **Step 4: 커밋**

```bash
git add vitest.config.ts src/test/setup.ts
git commit -m "chore: Vitest + Testing Library 설정"
```

---

## Task 3: Tailwind 커스텀 팔레트 + 폰트

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: tailwind.config.ts 덮어쓰기**

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        violet: {
          50:  "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
        },
        gray: {
          50:  "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
        },
      },
      fontFamily: {
        sans: ["Pretendard Variable", "sans-serif"],
        serif: ["Instrument Serif", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: globals.css 교체**

```css
/* src/app/globals.css */
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css");
@import url("https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-pretendard: "Pretendard Variable", sans-serif;
  --font-serif: "Instrument Serif", serif;
}

* {
  -webkit-tap-highlight-color: transparent;
}

body {
  font-family: var(--font-pretendard);
  background-color: #FAFAFA;
  color: #18181B;
  max-width: 430px;
  margin: 0 auto;
  min-height: 100dvh;
}

.font-serif {
  font-family: var(--font-serif);
}
```

- [ ] **Step 3: layout.tsx 업데이트**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이때 — 모임 일정 앱",
  description: "친구들과 일정을 맞추고 장소를 고르는 소셜 스케줄링 앱",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: 브라우저 확인**

`pnpm dev` 후 `http://localhost:3000` — Pretendard 폰트 로드 확인 (개발자도구 Network 탭).

- [ ] **Step 5: 커밋**

```bash
git add tailwind.config.ts src/app/globals.css src/app/layout.tsx
git commit -m "chore: Tailwind 커스텀 팔레트 + Pretendard/Instrument Serif 폰트 설정"
```

---

## Task 4: TypeScript 타입 + 목업 데이터

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/mock/index.ts`

- [ ] **Step 1: 공유 타입 정의**

```typescript
// src/types/index.ts
export type VoteChoice = "available" | "maybe" | "unavailable";
export type GroupStatus = "voting" | "confirmed" | "completed";
export type FriendshipStatus = "pending" | "accepted";

export type User = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  statusMessage: string | null;
};

export type Group = {
  id: string;
  name: string;
  hostId: string;
  status: GroupStatus;
  confirmedDate: string | null;
  placeId: string | null;
  createdAt: string;
  members: User[];
};

export type VoteSession = {
  id: string;
  groupId: string;
  candidateDates: string[];  // "YYYY-MM-DD"
  deadline: string;
};

export type Vote = {
  id: string;
  sessionId: string;
  userId: string;
  date: string;
  choice: VoteChoice;
  comment: string | null;
};

export type Place = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: "FD6" | "CE7" | "SW8";
  rating: number;
  imageUrl: string | null;
};

export type Memory = {
  id: string;
  groupId: string;
  date: string;
  placeId: string;
  photos: string[];
  note: string | null;
  participants: User[];
};

export type Schedule = {
  id: string;
  userId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  memo: string | null;
  type: "personal" | "group";
};
```

- [ ] **Step 2: 목업 데이터 작성**

```typescript
// src/lib/mock/index.ts
import type { User, Group, VoteSession, Vote, Place, Memory, Schedule } from "@/types";

export const mockCurrentUserId = "u5";

export const mockUsers: User[] = [
  { id: "u1", nickname: "김민준", profileImageUrl: null, statusMessage: "오늘도 화이팅" },
  { id: "u2", nickname: "이서연", profileImageUrl: null, statusMessage: null },
  { id: "u3", nickname: "박지호", profileImageUrl: null, statusMessage: "바쁜 하루" },
  { id: "u4", nickname: "최유나", profileImageUrl: null, statusMessage: null },
  { id: "u5", nickname: "나", profileImageUrl: null, statusMessage: "모임 앱 테스트 중" },
];

export const mockGroups: Group[] = [
  {
    id: "g1",
    name: "대학 동기 모임",
    hostId: "u5",
    status: "voting",
    confirmedDate: null,
    placeId: null,
    createdAt: "2026-04-10T10:00:00Z",
    members: [mockUsers[0], mockUsers[1], mockUsers[2], mockUsers[4]],
  },
  {
    id: "g2",
    name: "회사 팀 회식",
    hostId: "u1",
    status: "confirmed",
    confirmedDate: "2026-04-20",
    placeId: "p1",
    createdAt: "2026-04-05T09:00:00Z",
    members: [mockUsers[0], mockUsers[3], mockUsers[4]],
  },
  {
    id: "g3",
    name: "고등학교 친구들",
    hostId: "u2",
    status: "completed",
    confirmedDate: "2026-03-28",
    placeId: "p2",
    createdAt: "2026-03-20T11:00:00Z",
    members: [mockUsers[1], mockUsers[2], mockUsers[3], mockUsers[4]],
  },
];

export const mockVoteSession: VoteSession = {
  id: "vs1",
  groupId: "g1",
  candidateDates: ["2026-04-25", "2026-04-26", "2026-04-27"],
  deadline: "2026-04-20",
};

export const mockVotes: Vote[] = [
  { id: "v1", sessionId: "vs1", userId: "u1", date: "2026-04-25", choice: "available", comment: null },
  { id: "v2", sessionId: "vs1", userId: "u1", date: "2026-04-26", choice: "maybe", comment: "오후만 가능해요" },
  { id: "v3", sessionId: "vs1", userId: "u1", date: "2026-04-27", choice: "unavailable", comment: null },
  { id: "v4", sessionId: "vs1", userId: "u2", date: "2026-04-25", choice: "available", comment: null },
  { id: "v5", sessionId: "vs1", userId: "u2", date: "2026-04-26", choice: "available", comment: null },
  { id: "v6", sessionId: "vs1", userId: "u2", date: "2026-04-27", choice: "maybe", comment: null },
  { id: "v7", sessionId: "vs1", userId: "u3", date: "2026-04-25", choice: "available", comment: null },
  { id: "v8", sessionId: "vs1", userId: "u3", date: "2026-04-26", choice: "unavailable", comment: "선약 있어요" },
  { id: "v9", sessionId: "vs1", userId: "u3", date: "2026-04-27", choice: "unavailable", comment: null },
];

export const mockPlaces: Place[] = [
  { id: "p1", name: "강남 코너스톤", address: "서울 강남구 역삼동 123", latitude: 37.499, longitude: 127.026, category: "FD6", rating: 4.5, imageUrl: null },
  { id: "p2", name: "홍대 라운지", address: "서울 마포구 동교동 45", latitude: 37.552, longitude: 126.922, category: "CE7", rating: 4.2, imageUrl: null },
  { id: "p3", name: "이태원 비스트로", address: "서울 용산구 이태원동 78", latitude: 37.534, longitude: 126.994, category: "FD6", rating: 4.7, imageUrl: null },
];

export const mockMemories: Memory[] = [
  {
    id: "m1",
    groupId: "g3",
    date: "2026-03-28",
    placeId: "p2",
    photos: [],
    note: "오랜만에 모여서 너무 즐거웠다",
    participants: [mockUsers[1], mockUsers[2], mockUsers[3], mockUsers[4]],
  },
  {
    id: "m2",
    groupId: "g2",
    date: "2026-02-14",
    placeId: "p1",
    photos: [],
    note: null,
    participants: [mockUsers[0], mockUsers[3], mockUsers[4]],
  },
];

export const mockSchedules: Schedule[] = [
  { id: "s1", userId: "u5", title: "치과 예약", date: "2026-04-13", startTime: "14:00", endTime: "15:00", memo: null, type: "personal" },
  { id: "s2", userId: "u5", title: "분기 리뷰 미팅", date: "2026-04-15", startTime: "10:00", endTime: "11:30", memo: "회의실 A", type: "personal" },
  { id: "s3", userId: "u5", title: "회사 팀 회식", date: "2026-04-20", startTime: "18:00", endTime: "21:00", memo: null, type: "group" },
];
```

- [ ] **Step 3: 타입 체크**

```bash
pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/types/index.ts src/lib/mock/index.ts
git commit -m "feat: 공유 타입 + 목업 데이터 정의"
```

---

## Task 5: 유틸리티 함수 (TDD)

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/lib/date.ts`
- Create: `src/lib/vote.ts`
- Create: `src/lib/__tests__/date.test.ts`
- Create: `src/lib/__tests__/vote.test.ts`

- [ ] **Step 1: date.ts 테스트 작성**

```typescript
// src/lib/__tests__/date.test.ts
import { describe, it, expect } from "vitest";
import {
  getCalendarDays,
  isSameDay,
  formatMonthYear,
  formatDateShort,
} from "@/lib/date";

describe("getCalendarDays", () => {
  it("6주 * 7일 = 42개 날짜를 반환한다", () => {
    const days = getCalendarDays(new Date("2026-04-01"));
    expect(days).toHaveLength(42);
  });

  it("4월의 1일은 수요일이므로 앞에 3개의 빈 날짜가 있다", () => {
    const days = getCalendarDays(new Date("2026-04-01"));
    expect(days[0]).toBeNull();
    expect(days[1]).toBeNull();
    expect(days[2]).toBeNull();
    expect(days[3]).toEqual(new Date("2026-04-01"));
  });
});

describe("isSameDay", () => {
  it("같은 날짜는 true", () => {
    expect(isSameDay(new Date("2026-04-13"), new Date("2026-04-13"))).toBe(true);
  });
  it("다른 날짜는 false", () => {
    expect(isSameDay(new Date("2026-04-13"), new Date("2026-04-14"))).toBe(false);
  });
});

describe("formatMonthYear", () => {
  it("2026년 4월을 반환한다", () => {
    expect(formatMonthYear(new Date("2026-04-13"))).toBe("2026년 4월");
  });
});

describe("formatDateShort", () => {
  it("4월 13일 형식으로 반환한다", () => {
    expect(formatDateShort(new Date("2026-04-13"))).toBe("4월 13일");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm test --run src/lib/__tests__/date.test.ts
```

Expected: FAIL (date.ts 없음)

- [ ] **Step 3: date.ts 구현**

```typescript
// src/lib/date.ts
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  eachDayOfInterval,
  isSameDay as dfnsSameDay,
  format,
  addMonths,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";

/** 캘린더 그리드용 42칸 배열 (빈 칸은 null) */
export function getCalendarDays(date: Date): (Date | null)[] {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 0 });
  const end = startOfWeek(endOfMonth(date), { weekStartsOn: 0 });
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) });

  const grid: (Date | null)[] = [];
  const firstDayOfWeek = startOfMonth(date).getDay(); // 0=일

  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  daysInMonth.forEach((d) => grid.push(d));
  while (grid.length < 42) grid.push(null);

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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm test --run src/lib/__tests__/date.test.ts
```

Expected: 4 tests passed

- [ ] **Step 5: vote.ts 테스트 작성**

```typescript
// src/lib/__tests__/vote.test.ts
import { describe, it, expect } from "vitest";
import { getBestDate, getVoteSummary, isAllVoted } from "@/lib/vote";
import type { Vote, VoteSession } from "@/types";

const session: VoteSession = {
  id: "vs1",
  groupId: "g1",
  candidateDates: ["2026-04-25", "2026-04-26", "2026-04-27"],
  deadline: "2026-04-20",
};

const votes: Vote[] = [
  { id: "v1", sessionId: "vs1", userId: "u1", date: "2026-04-25", choice: "available", comment: null },
  { id: "v2", sessionId: "vs1", userId: "u1", date: "2026-04-26", choice: "maybe", comment: null },
  { id: "v3", sessionId: "vs1", userId: "u1", date: "2026-04-27", choice: "unavailable", comment: null },
  { id: "v4", sessionId: "vs1", userId: "u2", date: "2026-04-25", choice: "available", comment: null },
  { id: "v5", sessionId: "vs1", userId: "u2", date: "2026-04-26", choice: "available", comment: null },
  { id: "v6", sessionId: "vs1", userId: "u2", date: "2026-04-27", choice: "maybe", comment: null },
];

const memberIds = ["u1", "u2", "u3"];

describe("getBestDate", () => {
  it("available 투표가 가장 많은 날짜를 반환한다", () => {
    expect(getBestDate(session, votes)).toBe("2026-04-25");
  });
});

describe("getVoteSummary", () => {
  it("날짜별 available/maybe/unavailable 수를 반환한다", () => {
    const summary = getVoteSummary(session, votes);
    expect(summary["2026-04-25"]).toEqual({ available: 2, maybe: 0, unavailable: 0 });
    expect(summary["2026-04-26"]).toEqual({ available: 1, maybe: 1, unavailable: 0 });
  });
});

describe("isAllVoted", () => {
  it("모든 멤버가 투표했으면 true", () => {
    expect(isAllVoted(session, votes, ["u1", "u2"])).toBe(true);
  });
  it("투표 안 한 멤버가 있으면 false", () => {
    expect(isAllVoted(session, votes, memberIds)).toBe(false);
  });
});
```

- [ ] **Step 6: vote.ts 구현**

```typescript
// src/lib/vote.ts
import type { Vote, VoteSession } from "@/types";

type VoteSummary = Record<string, { available: number; maybe: number; unavailable: number }>;

export function getVoteSummary(session: VoteSession, votes: Vote[]): VoteSummary {
  const summary: VoteSummary = {};
  session.candidateDates.forEach((date) => {
    summary[date] = { available: 0, maybe: 0, unavailable: 0 };
  });
  votes.forEach(({ date, choice }) => {
    if (summary[date]) summary[date][choice]++;
  });
  return summary;
}

export function getBestDate(session: VoteSession, votes: Vote[]): string | null {
  const summary = getVoteSummary(session, votes);
  let best: string | null = null;
  let max = -1;
  session.candidateDates.forEach((date) => {
    if (summary[date].available > max) {
      max = summary[date].available;
      best = date;
    }
  });
  return best;
}

export function isAllVoted(session: VoteSession, votes: Vote[], memberIds: string[]): boolean {
  return memberIds.every((userId) =>
    session.candidateDates.every((date) =>
      votes.some((v) => v.userId === userId && v.date === date)
    )
  );
}
```

- [ ] **Step 7: cn() 유틸리티**

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: 전체 테스트 통과 확인**

```bash
pnpm test --run
```

Expected: 7 tests passed

- [ ] **Step 9: 커밋**

```bash
git add src/lib/
git commit -m "feat: cn(), date 헬퍼, 투표 집계 로직 + 테스트"
```

---

## Task 6: 공통 UI 컴포넌트

**Files:**
- Create: `src/components/ui/Avatar.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/__tests__/Avatar.test.tsx`

- [ ] **Step 1: Avatar 테스트 작성**

```typescript
// src/components/ui/__tests__/Avatar.test.tsx
import { render, screen } from "@testing-library/react";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";

describe("Avatar", () => {
  it("닉네임 이니셜을 렌더링한다", () => {
    render(<Avatar nickname="김민준" size="md" />);
    expect(screen.getByText("김")).toBeInTheDocument();
  });

  it("size에 따라 올바른 클래스를 가진다", () => {
    const { container } = render(<Avatar nickname="이서연" size="sm" />);
    expect(container.firstChild).toHaveClass("w-8");
  });
});

describe("AvatarGroup", () => {
  const users = [
    { id: "u1", nickname: "A" },
    { id: "u2", nickname: "B" },
    { id: "u3", nickname: "C" },
    { id: "u4", nickname: "D" },
    { id: "u5", nickname: "E" },
  ];

  it("5명 중 4개 + '+1' 배지를 렌더링한다", () => {
    render(<AvatarGroup users={users} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm test --run src/components/ui/__tests__/Avatar.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Avatar 컴포넌트 구현**

```tsx
// src/components/ui/Avatar.tsx
"use client";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

type AvatarProps = {
  nickname: string;
  profileImageUrl?: string | null;
  size?: Size;
  className?: string;
};

const sizeMap: Record<Size, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-16 h-16 text-lg",
};

export function Avatar({ nickname, profileImageUrl, size = "sm", className }: AvatarProps) {
  const initial = nickname.charAt(0);
  return (
    <div
      className={cn(
        "rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-medium border-2 border-white shrink-0",
        sizeMap[size],
        className
      )}
    >
      {profileImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profileImageUrl} alt={nickname} className="w-full h-full rounded-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

type AvatarGroupProps = {
  users: Array<{ id: string; nickname: string; profileImageUrl?: string | null }>;
  max?: number;
};

export function AvatarGroup({ users, max = 4 }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const rest = users.length - max;
  return (
    <div className="flex items-center">
      {visible.map((user, i) => (
        <Avatar
          key={user.id}
          nickname={user.nickname}
          profileImageUrl={user.profileImageUrl}
          size="sm"
          className={i > 0 ? "-ml-2" : ""}
        />
      ))}
      {rest > 0 && (
        <div className="-ml-2 w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs text-gray-500 shrink-0">
          +{rest}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm test --run src/components/ui/__tests__/Avatar.test.tsx
```

Expected: 3 tests passed

- [ ] **Step 5: Badge 컴포넌트**

```tsx
// src/components/ui/Badge.tsx
import { cn } from "@/lib/utils";
import type { GroupStatus } from "@/types";

type BadgeProps = {
  status: GroupStatus;
  className?: string;
};

const statusConfig: Record<GroupStatus, { label: string; className: string }> = {
  voting:    { label: "투표 중",  className: "bg-amber-50 text-amber-600" },
  confirmed: { label: "확정",    className: "bg-emerald-50 text-emerald-600" },
  completed: { label: "완료",    className: "bg-gray-100 text-gray-500" },
};

export function Badge({ status, className }: BadgeProps) {
  const { label, className: statusClass } = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-[6px] text-xs font-medium",
        statusClass,
        className
      )}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 6: Card 컴포넌트**

```tsx
// src/components/ui/Card.tsx
import { cn } from "@/lib/utils";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white border border-gray-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        onClick && "cursor-pointer active:scale-[0.98] active:bg-gray-50 transition-all duration-150",
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 7: Button 컴포넌트**

```tsx
// src/components/ui/Button.tsx
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = {
  children: React.ReactNode;
  variant?: Variant;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
};

const variantMap: Record<Variant, string> = {
  primary:   "bg-violet-600 text-white h-[52px] text-base font-semibold active:bg-violet-700",
  secondary: "bg-gray-100 text-gray-800 h-12 text-[15px] font-medium active:bg-gray-200",
  ghost:     "bg-transparent text-violet-600 h-11 text-sm",
  danger:    "bg-red-50 text-red-600 h-12 text-[15px] font-medium active:bg-red-100",
};

export function Button({
  children,
  variant = "primary",
  disabled = false,
  onClick,
  className,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg px-4 flex items-center justify-center transition-all duration-150 active:scale-[0.97] w-full",
        variantMap[variant],
        disabled && "opacity-40 pointer-events-none",
        className
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 8: 타입 체크**

```bash
pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 9: 커밋**

```bash
git add src/components/ui/
git commit -m "feat: Avatar, Badge, Card, Button 공통 컴포넌트"
```

---

## Task 7: BottomTabNav + (main) 레이아웃

**Files:**
- Create: `src/components/layout/BottomTabNav.tsx`
- Create: `src/app/(main)/layout.tsx`
- Modify: `src/app/page.tsx` (홈으로 리다이렉트)

- [ ] **Step 1: BottomTabNav 구현**

```tsx
// src/components/layout/BottomTabNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, PlusCircle, Map, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home",    label: "홈",    icon: Home },
  { href: "/friends", label: "친구",  icon: Users },
  { href: "/create",  label: "모임",  icon: PlusCircle },
  { href: "/map",     label: "지도",  icon: Map },
  { href: "/history", label: "기록",  icon: Clock },
] as const;

export function BottomTabNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-[83px] bg-white border-t border-gray-200 flex items-start pt-2 z-50">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className="flex-1 flex flex-col items-center gap-1 min-h-11 justify-center"
          >
            <Icon
              size={20}
              className={cn(active ? "text-violet-600" : "text-gray-400")}
              strokeWidth={1.5}
            />
            <span
              className={cn(
                "text-[10px] font-medium",
                active ? "text-violet-600" : "text-gray-400"
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: (main) 레이아웃**

```tsx
// src/app/(main)/layout.tsx
import { BottomTabNav } from "@/components/layout/BottomTabNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="pb-[83px] min-h-dvh">{children}</main>
      <BottomTabNav />
    </>
  );
}
```

- [ ] **Step 3: 루트 페이지 리다이렉트**

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/home");
}
```

- [ ] **Step 4: 각 탭 placeholder 페이지 생성**

```tsx
// src/app/(main)/home/page.tsx
export default function HomePage() { return <div className="p-5">홈</div>; }

// src/app/(main)/friends/page.tsx  
export default function FriendsPage() { return <div className="p-5">친구</div>; }

// src/app/(main)/create/page.tsx
export default function CreatePage() { return <div className="p-5">모임 만들기</div>; }

// src/app/(main)/map/page.tsx
export default function MapPage() { return <div className="p-5">지도</div>; }

// src/app/(main)/history/page.tsx
export default function HistoryPage() { return <div className="p-5">기록</div>; }
```

- [ ] **Step 5: 브라우저 확인**

`http://localhost:3000` → `/home` 리다이렉트, 하단 탭 표시, 탭 전환 정상 동작.

- [ ] **Step 6: 커밋**

```bash
git add src/app/ src/components/layout/
git commit -m "feat: BottomTabNav + (main) 레이아웃 + 탭 라우팅"
```

---

## Task 8: 홈 — MonthlyCalendar

**Files:**
- Create: `src/components/calendar/MonthlyCalendar.tsx`

- [ ] **Step 1: MonthlyCalendar 구현**

```tsx
// src/components/calendar/MonthlyCalendar.tsx
"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, subMonths, formatMonthYear, getCalendarDays, isSameDay } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { Schedule } from "@/types";

type MonthlyCalendarProps = {
  schedules: Schedule[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function MonthlyCalendar({ schedules, selectedDate, onSelectDate }: MonthlyCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = new Date();
  const days = getCalendarDays(currentMonth);

  return (
    <div className="px-5 pt-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <button
          aria-label="이전 달"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 -ml-2 text-gray-500 active:text-gray-800"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="text-lg font-semibold text-gray-800">
          {formatMonthYear(currentMonth)}
        </span>
        <button
          aria-label="다음 달"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 -mr-2 text-gray-500 active:text-gray-800"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const hasEvent = schedules.some((s) => isSameDay(new Date(s.date), day));

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(day)}
              aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일`}
              className="flex flex-col items-center py-1 min-h-11 justify-center"
            >
              <span
                className={cn(
                  "font-serif w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors",
                  isSelected && "bg-violet-600 text-white",
                  isToday && !isSelected && "bg-violet-100 text-violet-700 font-semibold",
                  !isToday && !isSelected && "text-gray-700"
                )}
              >
                {day.getDate()}
              </span>
              {hasEvent && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-violet-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/components/calendar/MonthlyCalendar.tsx
git commit -m "feat: MonthlyCalendar — date-fns + Instrument Serif 날짜"
```

---

## Task 9: 홈 — DayEventList + TodaySummaryCard + 페이지

**Files:**
- Create: `src/components/calendar/DayEventList.tsx`
- Create: `src/components/calendar/TodaySummaryCard.tsx`
- Modify: `src/app/(main)/home/page.tsx`

- [ ] **Step 1: DayEventList 구현**

```tsx
// src/components/calendar/DayEventList.tsx
import { formatDateShort, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { AvatarGroup } from "@/components/ui/Avatar";
import type { Schedule, Group } from "@/types";

type DayEventListProps = {
  date: Date;
  schedules: Schedule[];
  groups: Group[];
};

export function DayEventList({ date, schedules, groups }: DayEventListProps) {
  const daySchedules = schedules.filter((s) => {
    const sd = new Date(s.date);
    return sd.toDateString() === date.toDateString();
  });

  if (daySchedules.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-gray-500 text-sm">이 날은 일정이 없어요</p>
      </div>
    );
  }

  return (
    <div className="px-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 mt-4 mb-2">
        {formatDateShort(date)} 일정
      </h3>
      {daySchedules.map((schedule) => {
        const isGroup = schedule.type === "group";
        const relatedGroup = isGroup ? groups.find((g) => g.confirmedDate === schedule.date) : null;

        return (
          <div
            key={schedule.id}
            className={cn(
              "bg-white border border-gray-200 rounded-xl p-4 flex gap-3",
              "shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            )}
          >
            {/* 컬러 바 */}
            <div
              className={cn(
                "w-[3px] rounded-full shrink-0",
                isGroup ? "bg-violet-600" : "bg-gray-300"
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{schedule.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatTime(schedule.startTime)} — {formatTime(schedule.endTime)}
              </p>
              {relatedGroup && (
                <div className="mt-2">
                  <AvatarGroup users={relatedGroup.members} max={4} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TodaySummaryCard 구현**

```tsx
// src/components/calendar/TodaySummaryCard.tsx
import { formatDateShort } from "@/lib/date";
import type { Schedule } from "@/types";

type TodaySummaryCardProps = {
  schedules: Schedule[];
};

export function TodaySummaryCard({ schedules }: TodaySummaryCardProps) {
  const today = new Date();
  const todaySchedules = schedules.filter((s) => {
    const sd = new Date(s.date);
    return sd.toDateString() === today.toDateString();
  });
  const next = todaySchedules[0];

  return (
    <div className="mx-5 mt-5 bg-white border border-gray-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-xs font-medium text-gray-400 mb-1">오늘 · {formatDateShort(today)}</p>
      {todaySchedules.length === 0 ? (
        <p className="text-sm text-gray-500">오늘 일정이 없어요</p>
      ) : (
        <>
          <p className="text-base font-semibold text-gray-800">
            일정 {todaySchedules.length}개
          </p>
          {next && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              다음: {next.title}
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 홈 페이지 완성**

```tsx
// src/app/(main)/home/page.tsx
"use client";
import { useState } from "react";
import { MonthlyCalendar } from "@/components/calendar/MonthlyCalendar";
import { DayEventList } from "@/components/calendar/DayEventList";
import { TodaySummaryCard } from "@/components/calendar/TodaySummaryCard";
import { Button } from "@/components/ui/Button";
import { mockSchedules, mockGroups } from "@/lib/mock";

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <div className="bg-gray-50 min-h-dvh">
      <TodaySummaryCard schedules={mockSchedules} />
      <MonthlyCalendar
        schedules={mockSchedules}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      <div className="h-px bg-gray-200 mx-5 my-3" />
      <DayEventList date={selectedDate} schedules={mockSchedules} groups={mockGroups} />
      {mockSchedules.filter((s) => s.date === selectedDate.toISOString().slice(0, 10)).length === 0 && (
        <div className="px-5 mt-4">
          <Button variant="secondary">모임 만들기</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: /design-check 실행**

```
/design-check src/app/(main)/home/
```

통과 확인. 실패 시 지적된 항목 수정 후 재실행.

- [ ] **Step 5: 커밋**

```bash
git add src/components/calendar/ src/app/(main)/home/
git commit -m "feat: 홈 캘린더 대시보드 — MonthlyCalendar, DayEventList, TodaySummaryCard"
```

---

## Task 10: 친구/그룹 화면

**Files:**
- Create: `src/components/friends/FriendList.tsx`
- Create: `src/components/friends/GroupCard.tsx`
- Create: `src/components/friends/FilterChip.tsx`
- Modify: `src/app/(main)/friends/page.tsx`

- [ ] **Step 1: FilterChip 구현**

```tsx
// src/components/friends/FilterChip.tsx
"use client";
import { cn } from "@/lib/utils";
import type { GroupStatus } from "@/types";

type FilterValue = "all" | GroupStatus;

type FilterChipProps = {
  value: FilterValue;
  label: string;
  selected: boolean;
  onSelect: (value: FilterValue) => void;
};

export function FilterChip({ value, label, selected, onSelect }: FilterChipProps) {
  return (
    <button
      onClick={() => onSelect(value)}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0",
        selected
          ? "bg-violet-50 text-violet-600"
          : "bg-gray-100 text-gray-500"
      )}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: GroupCard 구현**

```tsx
// src/components/friends/GroupCard.tsx
import { AvatarGroup } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Group } from "@/types";

type GroupCardProps = {
  group: Group;
  onClick?: () => void;
};

export function GroupCard({ group, onClick }: GroupCardProps) {
  return (
    <Card onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{group.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {group.members.length}명
            {group.confirmedDate && ` · ${group.confirmedDate}`}
          </p>
        </div>
        <Badge status={group.status} />
      </div>
      <div className="mt-3">
        <AvatarGroup users={group.members} max={4} />
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: FriendList 구현**

```tsx
// src/components/friends/FriendList.tsx
"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type FriendListProps = {
  users: User[];
};

export function FriendList({ users }: FriendListProps) {
  const [query, setQuery] = useState("");
  const filtered = users.filter((u) =>
    u.nickname.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      {/* 검색바 */}
      <div className="px-5 py-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="친구 검색"
            className={cn(
              "w-full pl-9 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm",
              "outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white transition-all"
            )}
          />
        </div>
      </div>

      {/* 친구 목록 */}
      <div className="px-5 space-y-1">
        {filtered.map((user) => (
          <div key={user.id} className="flex items-center gap-3 py-2.5">
            <Avatar nickname={user.nickname} profileImageUrl={user.profileImageUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{user.nickname}</p>
              {user.statusMessage && (
                <p className="text-xs text-gray-400 truncate">{user.statusMessage}</p>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">검색 결과 없음</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 친구/그룹 페이지 완성**

```tsx
// src/app/(main)/friends/page.tsx
"use client";
import { useState } from "react";
import { FilterChip } from "@/components/friends/FilterChip";
import { GroupCard } from "@/components/friends/GroupCard";
import { FriendList } from "@/components/friends/FriendList";
import { mockUsers, mockGroups, mockCurrentUserId } from "@/lib/mock";
import type { GroupStatus } from "@/types";

type Tab = "friends" | "groups";
type FilterValue = "all" | GroupStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all",       label: "전체" },
  { value: "voting",    label: "투표 중" },
  { value: "confirmed", label: "확정" },
  { value: "completed", label: "완료" },
];

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>("friends");
  const [filter, setFilter] = useState<FilterValue>("all");

  const friends = mockUsers.filter((u) => u.id !== mockCurrentUserId);
  const groups = filter === "all"
    ? mockGroups
    : mockGroups.filter((g) => g.status === filter);

  return (
    <div className="bg-gray-50 min-h-dvh">
      {/* 탭 */}
      <div className="flex bg-white border-b border-gray-200 px-5">
        {(["friends", "groups"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-violet-600 text-violet-600" : "border-transparent text-gray-400"
            }`}
          >
            {t === "friends" ? "친구" : "모임"}
          </button>
        ))}
      </div>

      {tab === "friends" ? (
        <FriendList users={friends} />
      ) : (
        <div>
          {/* 필터 칩 */}
          <div className="flex gap-2 px-5 py-3 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => (
              <FilterChip
                key={f.value}
                value={f.value}
                label={f.label}
                selected={filter === f.value}
                onSelect={setFilter}
              />
            ))}
          </div>
          {/* 그룹 목록 */}
          <div className="px-5 space-y-3">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: /design-check 실행**

```
/design-check src/app/(main)/friends/
```

통과 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/components/friends/ src/app/(main)/friends/
git commit -m "feat: 친구/그룹 목록 — FriendList, GroupCard, FilterChip"
```

---

## Task 11: 투표 화면

**Note:** 이 Task는 `/vote-flow` 스킬을 사용하여 구현한다.

**Files:**
- Create: `src/components/vote/VoteCell.tsx`
- Create: `src/components/vote/VoteMatrix.tsx`
- Create: `src/components/vote/BestDateBanner.tsx`
- Create: `src/components/vote/StickyConfirmButton.tsx`
- Create: `src/components/vote/CommentSection.tsx`
- Create: `src/app/group/[id]/page.tsx`

- [ ] **Step 1: /vote-flow 스킬 실행**

```
/vote-flow
```

스킬이 VoteMatrix, VoteCell, BestDateBanner, StickyConfirmButton, CommentSection 구현과 `src/app/group/[id]/page.tsx` 완성을 안내한다. 스킬 지침을 따른다.

- [ ] **Step 2: 스킬 미사용 시 수동 구현 — VoteCell**

```tsx
// src/components/vote/VoteCell.tsx
"use client";
import { cn } from "@/lib/utils";
import type { VoteChoice } from "@/types";

type VoteCellProps = {
  choice: VoteChoice | null;
  isCurrentUser: boolean;
  onClick?: () => void;
};

const choiceConfig: Record<VoteChoice, { symbol: string; className: string }> = {
  available:   { symbol: "⭕", className: "text-violet-500" },
  maybe:       { symbol: "△",  className: "text-amber-400" },
  unavailable: { symbol: "✕",  className: "text-gray-300" },
};

export function VoteCell({ choice, isCurrentUser, onClick }: VoteCellProps) {
  return (
    <button
      onClick={onClick}
      disabled={!isCurrentUser}
      aria-label={choice ?? "미투표"}
      className={cn(
        "w-full h-11 flex items-center justify-center text-lg",
        isCurrentUser && "active:bg-gray-50 transition-colors",
        !isCurrentUser && "cursor-default"
      )}
    >
      {choice ? (
        <span className={choiceConfig[choice].className}>
          {choiceConfig[choice].symbol}
        </span>
      ) : (
        <span className="text-gray-200 text-sm">—</span>
      )}
    </button>
  );
}
```

- [ ] **Step 3: VoteMatrix 구현**

```tsx
// src/components/vote/VoteMatrix.tsx
"use client";
import { VoteCell } from "./VoteCell";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { getBestDate, getVoteSummary } from "@/lib/vote";
import type { Vote, VoteSession, User, VoteChoice } from "@/types";

type VoteMatrixProps = {
  session: VoteSession;
  votes: Vote[];
  members: User[];
  currentUserId: string;
  onVote: (date: string, choice: VoteChoice) => void;
};

export function VoteMatrix({ session, votes, members, currentUserId, onVote }: VoteMatrixProps) {
  const bestDate = getBestDate(session, votes);
  const summary = getVoteSummary(session, votes);

  const getVote = (userId: string, date: string): VoteChoice | null =>
    votes.find((v) => v.userId === userId && v.date === date)?.choice ?? null;

  const cycleChoice = (current: VoteChoice | null): VoteChoice => {
    if (!current || current === "unavailable") return "available";
    if (current === "available") return "maybe";
    return "unavailable";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-10" />
            {session.candidateDates.map((date) => (
              <th
                key={date}
                className={cn(
                  "text-center p-2 text-xs font-medium text-gray-500",
                  bestDate === date && "bg-violet-50"
                )}
              >
                {date.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td className="py-1 pr-2">
                <Avatar nickname={member.nickname} size="sm" />
              </td>
              {session.candidateDates.map((date) => {
                const choice = getVote(member.id, date);
                const isCurrentUser = member.id === currentUserId;
                return (
                  <td
                    key={date}
                    className={cn(bestDate === date && "bg-violet-50")}
                  >
                    <VoteCell
                      choice={choice}
                      isCurrentUser={isCurrentUser}
                      onClick={isCurrentUser ? () => onVote(date, cycleChoice(choice)) : undefined}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 집계 행 */}
      <div className="flex mt-2 px-2 gap-1">
        <div className="w-10" />
        {session.candidateDates.map((date) => (
          <div
            key={date}
            className={cn(
              "flex-1 text-center text-xs text-gray-500",
              bestDate === date && "text-violet-600 font-semibold"
            )}
          >
            {summary[date].available}명
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: BestDateBanner 구현**

```tsx
// src/components/vote/BestDateBanner.tsx
type BestDateBannerProps = {
  date: string | null;
};

export function BestDateBanner({ date }: BestDateBannerProps) {
  if (!date) return null;
  return (
    <div className="mx-5 my-3 bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center gap-2">
      <span className="text-violet-600 text-sm">⭐</span>
      <p className="text-sm font-medium text-violet-800">
        <span className="font-semibold">{date}</span>이 가장 많이 가능해요
      </p>
    </div>
  );
}
```

- [ ] **Step 5: StickyConfirmButton 구현**

```tsx
// src/components/vote/StickyConfirmButton.tsx
"use client";
import { Button } from "@/components/ui/Button";

type StickyConfirmButtonProps = {
  allVoted: boolean;
  isHost: boolean;
  onConfirm: () => void;
};

export function StickyConfirmButton({ allVoted, isHost, onConfirm }: StickyConfirmButtonProps) {
  if (!isHost) return null;
  return (
    <div className="fixed bottom-[83px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 py-3 bg-white border-t border-gray-200">
      <Button onClick={onConfirm} disabled={!allVoted}>
        {allVoted ? "일정 확정하기" : `투표 대기 중...`}
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: CommentSection 구현**

```tsx
// src/components/vote/CommentSection.tsx
import { Avatar } from "@/components/ui/Avatar";
import type { Vote, User } from "@/types";

type CommentSectionProps = {
  votes: Vote[];
  members: User[];
};

export function CommentSection({ votes, members }: CommentSectionProps) {
  const comments = votes.filter((v) => v.comment);
  if (comments.length === 0) return null;

  return (
    <div className="px-5 mt-4">
      <h3 className="text-sm font-semibold text-gray-500 mb-3">코멘트</h3>
      <div className="space-y-3">
        {comments.map((vote) => {
          const user = members.find((m) => m.id === vote.userId);
          if (!user) return null;
          return (
            <div key={vote.id} className="flex items-start gap-2">
              <Avatar nickname={user.nickname} size="sm" />
              <div className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2">
                <p className="text-xs font-medium text-gray-700">{user.nickname}</p>
                <p className="text-xs text-gray-500 mt-0.5">{vote.comment}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 투표 페이지 완성**

```tsx
// src/app/group/[id]/page.tsx
"use client";
import { useState } from "react";
import { VoteMatrix } from "@/components/vote/VoteMatrix";
import { BestDateBanner } from "@/components/vote/BestDateBanner";
import { StickyConfirmButton } from "@/components/vote/StickyConfirmButton";
import { CommentSection } from "@/components/vote/CommentSection";
import { getBestDate, isAllVoted } from "@/lib/vote";
import { mockGroups, mockVoteSession, mockVotes, mockCurrentUserId } from "@/lib/mock";
import type { Vote, VoteChoice } from "@/types";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function GroupDetailPage({ params }: { params: { id: string } }) {
  const group = mockGroups.find((g) => g.id === params.id) ?? mockGroups[0];
  const [votes, setVotes] = useState<Vote[]>(mockVotes);

  const handleVote = (date: string, choice: VoteChoice) => {
    setVotes((prev) => {
      const existing = prev.findIndex((v) => v.userId === mockCurrentUserId && v.date === date);
      if (existing >= 0) {
        return prev.map((v, i) => (i === existing ? { ...v, choice } : v));
      }
      return [...prev, { id: `v_${Date.now()}`, sessionId: mockVoteSession.id, userId: mockCurrentUserId, date, choice, comment: null }];
    });
  };

  const bestDate = getBestDate(mockVoteSession, votes);
  const allVoted = isAllVoted(mockVoteSession, votes, group.members.map((m) => m.id));
  const isHost = group.hostId === mockCurrentUserId;

  return (
    <div className="bg-gray-50 min-h-dvh pb-[140px]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 bg-white border-b border-gray-200">
        <Link href="/friends" aria-label="뒤로">
          <ChevronLeft size={24} className="text-gray-700" strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-800">{group.name}</h1>
          <p className="text-xs text-gray-500">{group.members.length}명 참여</p>
        </div>
      </div>

      <div className="px-5 mt-4">
        <VoteMatrix
          session={mockVoteSession}
          votes={votes}
          members={group.members}
          currentUserId={mockCurrentUserId}
          onVote={handleVote}
        />
      </div>

      <BestDateBanner date={bestDate} />
      <CommentSection votes={votes} members={group.members} />

      <StickyConfirmButton allVoted={allVoted} isHost={isHost} onConfirm={() => alert("일정이 확정됩니다!")} />
    </div>
  );
}
```

- [ ] **Step 8: /design-check 실행**

```
/design-check src/app/group/[id]/
```

통과 확인.

- [ ] **Step 9: 커밋**

```bash
git add src/components/vote/ src/app/group/
git commit -m "feat: 투표 화면 — VoteMatrix, VoteCell, BestDateBanner, StickyConfirmButton"
```

---

## Task 12: 지도 화면

**Files:**
- Create: `src/components/map/KakaoMapProvider.tsx`
- Create: `src/components/map/MapView.tsx`
- Create: `src/components/map/RadiusSlider.tsx`
- Create: `src/components/map/CategoryFilterBar.tsx`
- Create: `src/components/map/PlaceCardCarousel.tsx`
- Modify: `src/app/(main)/map/page.tsx`

**Note:** Phase 1에서 Kakao API 키 없음. `NEXT_PUBLIC_KAKAO_MAP_KEY` 미설정 시 placeholder 지도 표시.

- [ ] **Step 1: KakaoMapProvider 구현**

```tsx
// src/components/map/KakaoMapProvider.tsx
"use client";
import { createContext, useContext, useState, useEffect } from "react";
import Script from "next/script";

type KakaoMapContextValue = { isLoaded: boolean };
const KakaoMapContext = createContext<KakaoMapContextValue>({ isLoaded: false });

export function useKakaoMap() {
  return useContext(KakaoMapContext);
}

export function KakaoMapProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  if (!apiKey) {
    return (
      <KakaoMapContext.Provider value={{ isLoaded: false }}>
        {children}
      </KakaoMapContext.Provider>
    );
  }

  return (
    <KakaoMapContext.Provider value={{ isLoaded }}>
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => {
          window.kakao.maps.load(() => setIsLoaded(true));
        }}
      />
      {children}
    </KakaoMapContext.Provider>
  );
}
```

- [ ] **Step 2: MapView 구현 (Phase 1: placeholder)**

```tsx
// src/components/map/MapView.tsx
"use client";
import { useEffect, useRef } from "react";
import { useKakaoMap } from "./KakaoMapProvider";
import { MapPin } from "lucide-react";
import type { Place } from "@/types";

type MapViewProps = {
  places: Place[];
  selectedPlaceId: string | null;
  center?: { lat: number; lng: number };
};

export function MapView({ places, selectedPlaceId, center }: MapViewProps) {
  const { isLoaded } = useKakaoMap();
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    // Phase 2: 실제 Kakao Maps 렌더링
  }, [isLoaded, places, selectedPlaceId]);

  return (
    <div ref={mapRef} className="w-full h-full relative bg-gray-100">
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
          <MapPin size={32} strokeWidth={1.5} />
          <p className="text-sm">지도 로딩 중...</p>
          <p className="text-xs text-gray-300">NEXT_PUBLIC_KAKAO_MAP_KEY 설정 필요</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: CategoryFilterBar 구현**

```tsx
// src/components/map/CategoryFilterBar.tsx
"use client";
import { cn } from "@/lib/utils";

type Category = "FD6" | "CE7" | "SW8";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "FD6", label: "음식점" },
  { value: "CE7", label: "카페" },
  { value: "SW8", label: "지하철" },
];

type CategoryFilterBarProps = {
  selected: Category | null;
  onSelect: (c: Category | null) => void;
};

export function CategoryFilterBar({ selected, onSelect }: CategoryFilterBarProps) {
  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
      {CATEGORIES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onSelect(selected === value ? null : value)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-colors",
            selected === value
              ? "bg-violet-600 text-white"
              : "bg-white text-gray-700 border border-gray-200"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: RadiusSlider 구현**

```tsx
// src/components/map/RadiusSlider.tsx
"use client";

type RadiusSliderProps = {
  value: number;  // 미터
  onChange: (v: number) => void;
};

const STEPS = [500, 1000, 2000, 3000, 5000];

export function RadiusSlider({ value, onChange }: RadiusSliderProps) {
  const label = value >= 1000 ? `${value / 1000}km` : `${value}m`;
  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">탐색 반경</span>
        <span className="text-sm font-semibold text-violet-600">{label}</span>
      </div>
      <input
        type="range"
        min={0}
        max={STEPS.length - 1}
        value={STEPS.indexOf(value)}
        onChange={(e) => onChange(STEPS[Number(e.target.value)])}
        className="w-full accent-violet-600"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>500m</span>
        <span>5km</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: PlaceCardCarousel 구현**

```tsx
// src/components/map/PlaceCardCarousel.tsx
"use client";
import { cn } from "@/lib/utils";
import { MapPin, Star } from "lucide-react";
import type { Place } from "@/types";

type PlaceCardCarouselProps = {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function PlaceCardCarousel({ places, selectedId, onSelect }: PlaceCardCarouselProps) {
  return (
    <div className="flex gap-3 px-5 py-3 overflow-x-auto no-scrollbar">
      {places.map((place) => (
        <button
          key={place.id}
          onClick={() => onSelect(place.id)}
          className={cn(
            "shrink-0 w-48 bg-white rounded-xl border p-3 text-left transition-all",
            selectedId === place.id
              ? "border-violet-600 shadow-[0_0_0_1px_#7C3AED]"
              : "border-gray-200"
          )}
        >
          <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
            <MapPin size={20} className="text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{place.name}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{place.address}</p>
          <div className="flex items-center gap-1 mt-1">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            <span className="text-xs text-gray-500">{place.rating}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: 지도 페이지 완성**

```tsx
// src/app/(main)/map/page.tsx
"use client";
import { useState } from "react";
import { KakaoMapProvider } from "@/components/map/KakaoMapProvider";
import { MapView } from "@/components/map/MapView";
import { CategoryFilterBar } from "@/components/map/CategoryFilterBar";
import { RadiusSlider } from "@/components/map/RadiusSlider";
import { PlaceCardCarousel } from "@/components/map/PlaceCardCarousel";
import { mockPlaces } from "@/lib/mock";
import type { Place } from "@/types";

type Category = "FD6" | "CE7" | "SW8";

export default function MapPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [radius, setRadius] = useState(1000);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const filteredPlaces = selectedCategory
    ? mockPlaces.filter((p) => p.category === selectedCategory)
    : mockPlaces;

  return (
    <KakaoMapProvider>
      <div className="flex flex-col h-dvh">
        {/* 상단 필터바 */}
        <div className="bg-white border-b border-gray-200 z-10">
          <CategoryFilterBar selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>

        {/* 지도 */}
        <div className="flex-1 relative">
          <MapView
            places={filteredPlaces}
            selectedPlaceId={selectedPlaceId}
          />
        </div>

        {/* 하단 시트 */}
        <div className="bg-white border-t border-gray-200 pb-[83px]">
          <RadiusSlider value={radius} onChange={setRadius} />
          <PlaceCardCarousel
            places={filteredPlaces}
            selectedId={selectedPlaceId}
            onSelect={setSelectedPlaceId}
          />
        </div>
      </div>
    </KakaoMapProvider>
  );
}
```

- [ ] **Step 7: /design-check 실행**

```
/design-check src/app/(main)/map/
```

통과 확인.

- [ ] **Step 8: 커밋**

```bash
git add src/components/map/ src/app/(main)/map/
git commit -m "feat: 지도 화면 — KakaoMapProvider, MapView placeholder, PlaceCardCarousel"
```

---

## Task 13: 기록 화면

**Files:**
- Create: `src/components/history/StatsSummary.tsx`
- Create: `src/components/history/MemoryCard.tsx`
- Create: `src/components/history/TimelineView.tsx`
- Modify: `src/app/(main)/history/page.tsx`

- [ ] **Step 1: StatsSummary 구현**

```tsx
// src/components/history/StatsSummary.tsx
import type { Memory } from "@/types";

type StatsSummaryProps = {
  memories: Memory[];
};

export function StatsSummary({ memories }: StatsSummaryProps) {
  return (
    <div className="px-5 pt-5 pb-4 bg-white border-b border-gray-200">
      <p className="text-xs font-medium text-gray-400 mb-1">지금까지</p>
      <p className="font-serif text-4xl font-medium text-gray-900">
        {memories.length}
        <span className="text-2xl text-gray-600"> 번의 모임</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: MemoryCard 구현**

```tsx
// src/components/history/MemoryCard.tsx
import { MapPin, Users } from "lucide-react";
import { AvatarGroup } from "@/components/ui/Avatar";
import type { Memory, Place } from "@/types";

type MemoryCardProps = {
  memory: Memory;
  place: Place | undefined;
};

export function MemoryCard({ memory, place }: MemoryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {memory.photos.length > 0 && (
        <div className="w-full h-32 bg-gray-100" />
      )}
      <div className="p-4">
        <p className="text-xs font-medium text-gray-400">{memory.date}</p>
        {place && (
          <div className="flex items-center gap-1 mt-1">
            <MapPin size={12} className="text-gray-400" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-gray-800">{place.name}</p>
          </div>
        )}
        {memory.note && (
          <p className="text-xs text-gray-500 mt-2">{memory.note}</p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <AvatarGroup users={memory.participants} max={4} />
          <span className="text-xs text-gray-400">{memory.participants.length}명</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TimelineView 구현**

```tsx
// src/components/history/TimelineView.tsx
import { MemoryCard } from "./MemoryCard";
import type { Memory, Place } from "@/types";

type TimelineViewProps = {
  memories: Memory[];
  places: Place[];
};

export function TimelineView({ memories, places }: TimelineViewProps) {
  if (memories.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm text-gray-500">아직 완료된 모임이 없어요</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 relative">
      {/* 수직선 */}
      <div className="absolute left-[37px] top-4 bottom-4 w-px bg-gray-200" />
      <div className="space-y-4">
        {memories.map((memory) => (
          <div key={memory.id} className="flex gap-4">
            {/* 타임라인 도트 */}
            <div className="relative z-10 mt-4 shrink-0">
              <div className="w-4 h-4 rounded-full bg-white border-2 border-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <MemoryCard
                memory={memory}
                place={places.find((p) => p.id === memory.placeId)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 기록 페이지 완성**

```tsx
// src/app/(main)/history/page.tsx
import { StatsSummary } from "@/components/history/StatsSummary";
import { TimelineView } from "@/components/history/TimelineView";
import { mockMemories, mockPlaces } from "@/lib/mock";

export default function HistoryPage() {
  const sorted = [...mockMemories].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="bg-gray-50 min-h-dvh">
      <StatsSummary memories={mockMemories} />
      <TimelineView memories={sorted} places={mockPlaces} />
    </div>
  );
}
```

- [ ] **Step 5: /design-check 실행**

```
/design-check src/app/(main)/history/
```

통과 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/components/history/ src/app/(main)/history/
git commit -m "feat: 기록 화면 — TimelineView, MemoryCard, StatsSummary"
```

---

## Task 14: 최종 검증 + 정리

**Files:**
- Modify: `src/app/globals.css` (no-scrollbar 유틸리티 추가)

- [ ] **Step 1: no-scrollbar 유틸리티 추가**

`src/app/globals.css` 하단에 추가:

```css
@layer utilities {
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
}
```

- [ ] **Step 2: 전체 타입 체크**

```bash
pnpm typecheck
```

Expected: 에러 없음. 에러 있으면 수정 후 재실행.

- [ ] **Step 3: 전체 린트**

```bash
pnpm lint
```

Expected: 경고/에러 없음.

- [ ] **Step 4: 전체 테스트**

```bash
pnpm test --run
```

Expected: 7+ tests passed.

- [ ] **Step 5: 데모 플로우 수동 확인**

`pnpm dev` 후 아래 플로우 확인:
1. `/home` — 캘린더 날짜 클릭 → DayEventList 변경
2. `/friends` — 탭 전환(친구/모임), 필터 칩, 검색
3. `/friends`의 GroupCard 클릭 → `/group/g1` 투표 화면
4. 투표 셀 클릭 → ⭕/△/✕ 순환
5. `/map` — 카테고리 필터, 반경 슬라이더, 장소 카드 선택
6. `/history` — 타임라인 표시

- [ ] **Step 6: 최종 커밋**

```bash
git add src/app/globals.css
git commit -m "chore: no-scrollbar 유틸리티 + Phase 1 완료"
```

---

## 완료 기준 체크리스트

- [ ] 5개 화면 모두 `/design-check` 통과
- [ ] `pnpm typecheck` 에러 없음
- [ ] `pnpm lint` 에러 없음
- [ ] `pnpm test --run` 전체 통과
- [ ] 데모 플로우 끊김 없이 동작
- [ ] `docs/HANDOFF.md` 작성 (Phase 2 진입 전)
