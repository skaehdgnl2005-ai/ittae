# 시간표 투표 고도화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing date-only O/△/X voting system (VoteMatrix) with a date O/X toggle + 30-minute time-grid voting system, including heatmap visualization and best-time calculation.

**Architecture:** Single integrated view with three vertical sections: DateToggleRow (date O/X), BestTimeBanner (optimal overlap), TimeGrid (12:00–20:00 slots). State machine hook (`useTimeSlotSelection`) manages "click-two-endpoints" range selection. New `time_slots` table stores per-user time ranges; existing `votes` table drops `maybe` choice. All realtime via Supabase channels.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (PostgreSQL + Realtime + RLS), Vitest

**Spec:** `docs/superpowers/specs/2026-04-14-time-slot-voting-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/002_time_slots.sql` | DB migration: time_slots table, groups columns, votes constraint |
| `src/components/vote/DateToggleRow.tsx` | Date O/X/미선택 toggle row |
| `src/components/vote/BestTimeBanner.tsx` | Optimal time-slot banner (replaces BestDateBanner) |
| `src/components/vote/TimeGrid.tsx` | Time grid container (columns + time labels) |
| `src/components/vote/TimeColumn.tsx` | Single date's 16 time-slot column |
| `src/components/vote/TimeSlotCell.tsx` | Individual 30-min cell |
| `src/hooks/useTimeSlotSelection.ts` | Range-selection state machine |
| `src/app/api/vote-sessions/[id]/time-slots/route.ts` | PUT/GET time-slots API |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `TimeSlot` type, remove `maybe` from `VoteChoice` |
| `src/lib/vote.ts` | Remove `maybe` from summary, add `getBestTimeSlot`, `getTimeSlotHeatmap`, `TIME_SLOTS` constant |
| `src/lib/mappers.ts` | Add `mapTimeSlot` function |
| `src/lib/mock/index.ts` | Update mockVotes (remove maybe), add `mockTimeSlots` |
| `src/hooks/useVoteRealtime.ts` | Add time_slots channel subscription |
| `src/app/group/[id]/GroupDetailClient.tsx` | Replace VoteMatrix/BestDateBanner with new components, add time-slot state |
| `src/app/group/[id]/page.tsx` | Fetch initial time-slots from server |
| `src/app/api/vote-sessions/[id]/votes/route.ts` | Reject `maybe` choice with 400 |
| `src/app/api/groups/[id]/confirm/route.ts` | Accept `confirmedStartTime`, `confirmedEndTime` |
| `src/components/vote/StickyConfirmButton.tsx` | Show confirmed time range |

### Deleted Files
| File | Reason |
|------|--------|
| `src/components/vote/VoteMatrix.tsx` | Replaced by DateToggleRow + TimeGrid |
| `src/components/vote/VoteCell.tsx` | Replaced by TimeSlotCell |
| `src/components/vote/BestDateBanner.tsx` | Replaced by BestTimeBanner |

---

## Task 0: DB Migration

**Files:**
- Create: `supabase/migrations/002_time_slots.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================
-- 002_time_slots.sql
-- 시간표 투표 고도화: time_slots 테이블 + groups 확정 시간 + votes maybe 제거
-- ============================================================

-- 1. time_slots 테이블 생성
create table time_slots (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references vote_sessions(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now(),
  constraint time_slots_valid_range check (start_time < end_time),
  constraint time_slots_unique unique (session_id, user_id, date, start_time)
);

alter table time_slots enable row level security;

-- RLS: 같은 모임 멤버만 조회
create policy "time_slots_select_member" on time_slots
  for select using (
    exists (
      select 1 from vote_sessions vs
      join group_members gm on gm.group_id = vs.group_id
      where vs.id = time_slots.session_id and gm.user_id = auth.uid()
    )
  );

-- RLS: 본인 슬롯만 생성
create policy "time_slots_insert_self" on time_slots
  for insert with check (user_id = auth.uid());

-- RLS: 본인 슬롯만 삭제
create policy "time_slots_delete_self" on time_slots
  for delete using (user_id = auth.uid());

-- 2. groups 테이블에 확정 시간 컬럼 추가
alter table groups add column confirmed_start_time time;
alter table groups add column confirmed_end_time time;

-- 3. votes 테이블 maybe 제거
delete from votes where choice = 'maybe';
alter table votes drop constraint if exists votes_choice_check;
alter table votes add constraint votes_choice_check
  check (choice in ('available', 'unavailable'));
```

- [ ] **Step 2: Verify migration syntax**

Run: `cat supabase/migrations/002_time_slots.sql`

Confirm the file has all 3 sections: time_slots creation, groups alter, votes constraint change.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_time_slots.sql
git commit -m "feat: add time_slots migration, drop maybe from votes"
```

---

## Task 1: Types & Mappers

**Files:**
- Modify: `src/types/index.ts:1-3` (VoteChoice)
- Modify: `src/types/index.ts` (add TimeSlot)
- Modify: `src/lib/mappers.ts` (add mapTimeSlot)

- [ ] **Step 1: Update VoteChoice type**

In `src/types/index.ts`, change line 1:

```typescript
// Before:
export type VoteChoice = "available" | "maybe" | "unavailable";

// After:
export type VoteChoice = "available" | "unavailable";
```

- [ ] **Step 2: Add TimeSlot type**

Add after the `Vote` type in `src/types/index.ts`:

```typescript
export type TimeSlot = {
  id: string;
  sessionId: string;
  userId: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
};
```

- [ ] **Step 3: Add mapTimeSlot to mappers.ts**

Add at the end of `src/lib/mappers.ts`:

```typescript
import type { TimeSlot } from "@/types";

export function mapTimeSlot(
  row: { id: string; session_id: string; user_id: string; date: string; start_time: string; end_time: string }
): TimeSlot {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}
```

Note: We use a plain object type for the row parameter instead of `Database["public"]["Tables"]["time_slots"]["Row"]` because `pnpm db:types` hasn't been run yet. This will work with both the mock system and real Supabase rows.

- [ ] **Step 4: Verify no type errors from maybe removal**

Run: `pnpm typecheck`

Expected: Errors in files still referencing `"maybe"` — these will be fixed in subsequent tasks. Note which files error.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/mappers.ts
git commit -m "feat: add TimeSlot type, remove maybe from VoteChoice"
```

---

## Task 2: Vote Utility Functions

**Files:**
- Modify: `src/lib/vote.ts`

- [ ] **Step 1: Write tests for new utility functions**

Create `src/lib/__tests__/vote.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getBestTimeSlot,
  getTimeSlotHeatmap,
  TIME_SLOTS,
  getVoteSummary,
  getBestDate,
} from "@/lib/vote";
import type { VoteSession, Vote, TimeSlot } from "@/types";

const session: VoteSession = {
  id: "vs1",
  groupId: "g1",
  candidateDates: ["2026-04-25", "2026-04-26"],
  deadline: "",
};

describe("TIME_SLOTS", () => {
  it("has 16 slots from 12:00 to 19:30", () => {
    expect(TIME_SLOTS).toHaveLength(16);
    expect(TIME_SLOTS[0]).toBe("12:00");
    expect(TIME_SLOTS[15]).toBe("19:30");
  });
});

describe("getVoteSummary (no maybe)", () => {
  it("counts only available and unavailable", () => {
    const votes: Vote[] = [
      { id: "v1", sessionId: "vs1", userId: "u1", date: "2026-04-25", choice: "available", comment: null },
      { id: "v2", sessionId: "vs1", userId: "u2", date: "2026-04-25", choice: "unavailable", comment: null },
    ];
    const result = getVoteSummary(session, votes);
    expect(result["2026-04-25"]).toEqual({ available: 1, unavailable: 1 });
  });
});

describe("getTimeSlotHeatmap", () => {
  it("counts overlapping users per slot", () => {
    const slots: TimeSlot[] = [
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "16:00" },
      { id: "t2", sessionId: "vs1", userId: "u2", date: "2026-04-25", startTime: "15:00", endTime: "17:00" },
    ];
    const heatmap = getTimeSlotHeatmap(slots, "2026-04-25");
    // 14:00 — only u1
    expect(heatmap["14:00"]).toBe(1);
    expect(heatmap["14:30"]).toBe(1);
    // 15:00, 15:30 — both u1 and u2
    expect(heatmap["15:00"]).toBe(2);
    expect(heatmap["15:30"]).toBe(2);
    // 16:00, 16:30 — only u2
    expect(heatmap["16:00"]).toBe(1);
    expect(heatmap["16:30"]).toBe(1);
    // 17:00 — nobody (endTime is exclusive)
    expect(heatmap["17:00"]).toBe(0);
  });

  it("returns all zeros for empty slots", () => {
    const heatmap = getTimeSlotHeatmap([], "2026-04-25");
    expect(heatmap["12:00"]).toBe(0);
    expect(heatmap["19:30"]).toBe(0);
  });
});

describe("getBestTimeSlot", () => {
  it("finds the time range with maximum overlap across all dates", () => {
    const slots: TimeSlot[] = [
      // u1: 14:00–17:00 on 4/25
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "17:00" },
      // u2: 14:00–17:00 on 4/25
      { id: "t2", sessionId: "vs1", userId: "u2", date: "2026-04-25", startTime: "14:00", endTime: "17:00" },
      // u3: 15:00–17:00 on 4/25
      { id: "t3", sessionId: "vs1", userId: "u3", date: "2026-04-25", startTime: "15:00", endTime: "17:00" },
      // u1: 13:00–14:00 on 4/26
      { id: "t4", sessionId: "vs1", userId: "u1", date: "2026-04-26", startTime: "13:00", endTime: "14:00" },
    ];
    const result = getBestTimeSlot(slots, ["2026-04-25", "2026-04-26"]);
    expect(result).not.toBeNull();
    expect(result!.date).toBe("2026-04-25");
    // Best overlap is 3 people at 15:00-17:00
    expect(result!.count).toBe(3);
    expect(result!.startTime).toBe("15:00");
    expect(result!.endTime).toBe("17:00");
  });

  it("returns null when no slots exist", () => {
    const result = getBestTimeSlot([], ["2026-04-25"]);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/__tests__/vote.test.ts`

Expected: FAIL — `getBestTimeSlot`, `getTimeSlotHeatmap`, `TIME_SLOTS` not exported.

- [ ] **Step 3: Rewrite src/lib/vote.ts with all functions**

Replace entire `src/lib/vote.ts`:

```typescript
import type { Vote, VoteSession, TimeSlot } from "@/types";

/** 12:00–19:30, 30분 간격, 16개 슬롯 */
export const TIME_SLOTS: string[] = Array.from({ length: 16 }, (_, i) => {
  const hour = 12 + Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  return `${hour}:${min}`;
});

type VoteSummary = Record<string, { available: number; unavailable: number }>;

export function getVoteSummary(
  session: VoteSession,
  votes: Vote[]
): VoteSummary {
  const summary: VoteSummary = {};
  session.candidateDates.forEach((date) => {
    summary[date] = { available: 0, unavailable: 0 };
  });
  votes.forEach(({ date, choice }) => {
    if (summary[date]) {
      summary[date][choice]++;
    }
  });
  return summary;
}

export function getBestDate(
  session: VoteSession,
  votes: Vote[]
): string | null {
  const summary = getVoteSummary(session, votes);
  let best: string | null = null;
  let max = 0;
  session.candidateDates.forEach((date) => {
    if (summary[date].available > max) {
      max = summary[date].available;
      best = date;
    }
  });
  return best;
}

export function isAllVoted(
  session: VoteSession,
  votes: Vote[],
  memberIds: string[]
): boolean {
  return memberIds.every((userId) =>
    session.candidateDates.every((date) =>
      votes.some((v) => v.userId === userId && v.date === date)
    )
  );
}

/**
 * 특정 날짜의 슬롯별 가용 인원 수를 집계한다.
 * 키: "HH:MM" (TIME_SLOTS 각 항목), 값: 해당 슬롯을 포함하는 유저 수.
 * startTime 이상, endTime 미만의 슬롯을 "포함"으로 판단한다.
 */
export function getTimeSlotHeatmap(
  slots: TimeSlot[],
  date: string
): Record<string, number> {
  const heatmap: Record<string, number> = {};
  TIME_SLOTS.forEach((t) => {
    heatmap[t] = 0;
  });

  const dateSlots = slots.filter((s) => s.date === date);
  for (const slot of dateSlots) {
    for (const t of TIME_SLOTS) {
      if (t >= slot.startTime && t < slot.endTime) {
        heatmap[t]++;
      }
    }
  }

  return heatmap;
}

type BestTimeResult = {
  date: string;
  startTime: string;
  endTime: string;
  count: number;
};

/**
 * 전체 멤버 슬롯에서 최대 겹침 구간을 찾는다.
 * 가장 많은 인원이 겹치는 연속 구간 중 가장 긴 것을 반환한다.
 */
export function getBestTimeSlot(
  slots: TimeSlot[],
  dates: string[]
): BestTimeResult | null {
  let best: BestTimeResult | null = null;

  for (const date of dates) {
    const heatmap = getTimeSlotHeatmap(slots, date);
    const maxCount = Math.max(...Object.values(heatmap));
    if (maxCount === 0) continue;

    // maxCount인 연속 구간 찾기
    let start: string | null = null;
    for (let i = 0; i <= TIME_SLOTS.length; i++) {
      const t = i < TIME_SLOTS.length ? TIME_SLOTS[i] : null;
      const count = t ? heatmap[t] : 0;

      if (count === maxCount && start === null) {
        start = t!;
      } else if (count !== maxCount && start !== null) {
        // 구간 끝: endTime은 현재 슬롯의 30분 뒤
        const prevSlot = TIME_SLOTS[i - 1];
        const endHour = Math.floor(parseInt(prevSlot.split(":")[0]));
        const endMin = parseInt(prevSlot.split(":")[1]);
        const endTime =
          endMin === 30
            ? `${endHour + 1}:00`
            : `${endHour}:30`;

        if (!best || maxCount > best.count || (maxCount === best.count && start < best.startTime)) {
          best = { date, startTime: start, endTime, count: maxCount };
        }
        start = null;
      }
    }
  }

  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/__tests__/vote.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vote.ts src/lib/__tests__/vote.test.ts
git commit -m "feat: add time-slot heatmap and best-time utilities"
```

---

## Task 3: Time-Slots API

**Files:**
- Create: `src/app/api/vote-sessions/[id]/time-slots/route.ts`

- [ ] **Step 1: Create the time-slots route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";
import { mapTimeSlot } from "@/lib/mappers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: sessionId } = await params;
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("time_slots")
    .select("*")
    .eq("session_id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []).map(mapTimeSlot) });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id: sessionId } = await params;
  const body: { date: string; slots: { startTime: string; endTime: string }[] } =
    await request.json();

  const supabase = await createServerClient();

  // Delete existing slots for this user+date
  const { error: deleteError } = await supabase
    .from("time_slots")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .eq("date", body.date);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (body.slots.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Insert new slots
  const rows = body.slots.map((s) => ({
    session_id: sessionId,
    user_id: user.id,
    date: body.date,
    start_time: s.startTime,
    end_time: s.endTime,
  }));

  const { data, error: insertError } = await supabase
    .from("time_slots")
    .insert(rows)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []).map(mapTimeSlot) });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/vote-sessions/\[id\]/time-slots/route.ts
git commit -m "feat: add PUT/GET time-slots API endpoint"
```

---

## Task 4: Modify Existing APIs

**Files:**
- Modify: `src/app/api/vote-sessions/[id]/votes/route.ts:28-58` (POST handler)
- Modify: `src/app/api/groups/[id]/confirm/route.ts:15,33-39`

- [ ] **Step 1: Reject maybe in votes POST**

In `src/app/api/vote-sessions/[id]/votes/route.ts`, add validation at the start of the POST handler (after auth check, before Supabase insert):

```typescript
  if (body.choice === "maybe") {
    return NextResponse.json(
      { error: "maybe choice is no longer supported" },
      { status: 400 }
    );
  }
```

Add the same check at the start of the PATCH handler body.

- [ ] **Step 2: Update confirm API to accept time fields**

In `src/app/api/groups/[id]/confirm/route.ts`, change the body type and update query:

```typescript
// Change body type from:
const body: { confirmedDate: string } = await request.json();

// To:
const body: {
  confirmedDate: string;
  confirmedStartTime?: string;
  confirmedEndTime?: string;
} = await request.json();
```

Update the `.update()` call:

```typescript
  const { data: updated, error } = await supabase
    .from("groups")
    .update({
      status: "confirmed",
      confirmed_date: body.confirmedDate,
      ...(body.confirmedStartTime && { confirmed_start_time: body.confirmedStartTime }),
      ...(body.confirmedEndTime && { confirmed_end_time: body.confirmedEndTime }),
    })
    .eq("id", id)
    .select()
    .single();
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

Fix any errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/vote-sessions/\[id\]/votes/route.ts src/app/api/groups/\[id\]/confirm/route.ts
git commit -m "feat: reject maybe votes, add time fields to confirm API"
```

---

## Task 5: useTimeSlotSelection Hook

**Files:**
- Create: `src/hooks/useTimeSlotSelection.ts`

- [ ] **Step 1: Write the hook test**

Create `src/hooks/__tests__/useTimeSlotSelection.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimeSlotSelection } from "../useTimeSlotSelection";

describe("useTimeSlotSelection", () => {
  it("starts in idle state with no selection", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    expect(result.current.state).toBe("idle");
    expect(result.current.pendingStart).toBeNull();
    expect(result.current.getSelectedRanges("2026-04-25")).toEqual([]);
  });

  it("selects a range with two clicks", () => {
    const { result } = renderHook(() => useTimeSlotSelection());

    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    expect(result.current.state).toBe("startSelected");
    expect(result.current.pendingStart).toEqual({ date: "2026-04-25", time: "14:00" });

    act(() => result.current.handleCellClick("2026-04-25", "16:00"));
    expect(result.current.state).toBe("idle");
    const ranges = result.current.getSelectedRanges("2026-04-25");
    expect(ranges).toEqual([{ startTime: "14:00", endTime: "16:30" }]);
  });

  it("auto-swaps if end is before start", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    act(() => result.current.handleCellClick("2026-04-25", "16:00"));
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    const ranges = result.current.getSelectedRanges("2026-04-25");
    expect(ranges).toEqual([{ startTime: "14:00", endTime: "16:30" }]);
  });

  it("cancels on re-click of start cell", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    expect(result.current.state).toBe("idle");
    expect(result.current.getSelectedRanges("2026-04-25")).toEqual([]);
  });

  it("clicking a different column resets start to new column", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    act(() => result.current.handleCellClick("2026-04-26", "15:00"));
    expect(result.current.pendingStart).toEqual({ date: "2026-04-26", time: "15:00" });
  });

  it("deselects an entire range when clicking a selected cell", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    // Select 14:00–16:30
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    act(() => result.current.handleCellClick("2026-04-25", "16:00"));

    // Click inside that range → deselect it
    act(() => result.current.handleCellClick("2026-04-25", "15:00"));
    expect(result.current.getSelectedRanges("2026-04-25")).toEqual([]);
  });

  it("supports multiple ranges on one date", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    // Range 1: 12:00–13:30
    act(() => result.current.handleCellClick("2026-04-25", "12:00"));
    act(() => result.current.handleCellClick("2026-04-25", "13:00"));
    // Range 2: 16:00–17:30
    act(() => result.current.handleCellClick("2026-04-25", "16:00"));
    act(() => result.current.handleCellClick("2026-04-25", "17:00"));

    const ranges = result.current.getSelectedRanges("2026-04-25");
    expect(ranges).toHaveLength(2);
  });

  it("initializes from existing TimeSlot data", () => {
    const existing = [
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "16:00" },
    ];
    const { result } = renderHook(() => useTimeSlotSelection(existing));
    const ranges = result.current.getSelectedRanges("2026-04-25");
    expect(ranges).toEqual([{ startTime: "14:00", endTime: "16:00" }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/hooks/__tests__/useTimeSlotSelection.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useTimeSlotSelection.ts`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { TIME_SLOTS } from "@/lib/vote";
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
    getSelectedRanges,
    isSlotSelected,
    resetFromSlots,
    rangesByDate,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/hooks/__tests__/useTimeSlotSelection.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTimeSlotSelection.ts src/hooks/__tests__/useTimeSlotSelection.test.ts
git commit -m "feat: add useTimeSlotSelection hook with range state machine"
```

---

## Task 6: Vote Components

**Files:**
- Create: `src/components/vote/DateToggleRow.tsx`
- Create: `src/components/vote/BestTimeBanner.tsx`
- Create: `src/components/vote/TimeSlotCell.tsx`
- Create: `src/components/vote/TimeColumn.tsx`
- Create: `src/components/vote/TimeGrid.tsx`
- Delete: `src/components/vote/VoteMatrix.tsx`
- Delete: `src/components/vote/VoteCell.tsx`
- Delete: `src/components/vote/BestDateBanner.tsx`

### Step-by-step

- [ ] **Step 1: Create DateToggleRow**

Create `src/components/vote/DateToggleRow.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { VoteChoice } from "@/types";

type DateToggleRowProps = {
  dates: string[];
  choices: Record<string, VoteChoice | null>;
  onToggle: (date: string) => void;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[d.getDay()];
  return `${month}/${day}(${weekday})`;
}

export function DateToggleRow({ dates, choices, onToggle }: DateToggleRowProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {dates.map((date) => {
        const choice = choices[date] ?? null;
        return (
          <button
            key={date}
            onClick={() => onToggle(date)}
            aria-label={`${formatDate(date)} ${choice === "available" ? "가능" : choice === "unavailable" ? "불가" : "미선택"}`}
            className={cn(
              "flex-shrink-0 min-h-11 min-w-11 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              "border",
              choice === "available" &&
                "bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300",
              choice === "unavailable" &&
                "bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-500",
              choice === null &&
                "bg-white border-dashed border-gray-300 text-gray-500 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-400"
            )}
          >
            <span className="block text-xs">
              {choice === "available" ? "O" : choice === "unavailable" ? "X" : "—"}
            </span>
            <span className="block">{formatDate(date)}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create BestTimeBanner**

Create `src/components/vote/BestTimeBanner.tsx`:

```typescript
type BestTimeBannerProps = {
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  count: number;
  totalMembers: number;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}/${day}(${weekdays[d.getDay()]})`;
}

export function BestTimeBanner({
  date,
  startTime,
  endTime,
  count,
  totalMembers,
}: BestTimeBannerProps) {
  if (!date || !startTime || !endTime) return null;

  const allAvailable = count === totalMembers;

  return (
    <div className="mx-5 my-3 bg-violet-50 border border-violet-200 rounded-xl p-3 dark:bg-violet-900/20 dark:border-violet-800">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-sm">⭐</span>
        <div>
          <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
            {formatDate(date)} {startTime}~{endTime}
          </p>
          <p className="text-xs text-violet-600 dark:text-violet-400">
            {allAvailable ? `${count}명 전원 가능` : `${count}명 가능`}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create TimeSlotCell**

Create `src/components/vote/TimeSlotCell.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";

type TimeSlotCellProps = {
  time: string;
  disabled: boolean;
  selected: boolean;
  isPendingStart: boolean;
  heatCount: number;
  totalMembers: number;
  showHeatmap: boolean;
  onClick: () => void;
};

function getHeatmapClass(count: number, total: number): string {
  if (count === 0) return "bg-gray-100 dark:bg-gray-800";
  if (count === total) return "bg-violet-700 dark:bg-violet-600";
  if (count >= 3) return "bg-violet-500 dark:bg-violet-500";
  if (count >= 2) return "bg-violet-300 dark:bg-violet-400";
  return "bg-violet-100 dark:bg-violet-900/40";
}

export function TimeSlotCell({
  time,
  disabled,
  selected,
  isPendingStart,
  heatCount,
  totalMembers,
  showHeatmap,
  onClick,
}: TimeSlotCellProps) {
  if (disabled) {
    return (
      <div
        className="h-8 bg-gray-200 dark:bg-gray-700 opacity-35"
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={showHeatmap}
      aria-label={`${time} ${selected ? "선택됨" : "미선택"}`}
      className={cn(
        "h-8 w-full transition-colors border-b border-gray-100 dark:border-gray-800",
        showHeatmap
          ? getHeatmapClass(heatCount, totalMembers)
          : selected
            ? "bg-violet-500 dark:bg-violet-600"
            : isPendingStart
              ? "bg-violet-300 ring-2 ring-violet-500 dark:bg-violet-400"
              : "bg-white hover:bg-violet-50 dark:bg-gray-900 dark:hover:bg-violet-900/20"
      )}
    />
  );
}
```

- [ ] **Step 4: Create TimeColumn**

Create `src/components/vote/TimeColumn.tsx`:

```typescript
"use client";

import { TIME_SLOTS } from "@/lib/vote";
import { TimeSlotCell } from "./TimeSlotCell";

type TimeColumnProps = {
  date: string;
  disabled: boolean;
  isSlotSelected: (date: string, time: string) => boolean;
  pendingStart: { date: string; time: string } | null;
  heatmap: Record<string, number>;
  totalMembers: number;
  showHeatmap: boolean;
  onCellClick: (date: string, time: string) => void;
};

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TimeColumn({
  date,
  disabled,
  isSlotSelected,
  pendingStart,
  heatmap,
  totalMembers,
  showHeatmap,
  onCellClick,
}: TimeColumnProps) {
  return (
    <div className={disabled ? "opacity-35" : ""}>
      <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 pb-1">
        {formatDateShort(date)}
      </div>
      <div className="flex flex-col">
        {TIME_SLOTS.map((time) => (
          <TimeSlotCell
            key={time}
            time={time}
            disabled={disabled}
            selected={isSlotSelected(date, time)}
            isPendingStart={
              pendingStart?.date === date && pendingStart?.time === time
            }
            heatCount={heatmap[time] ?? 0}
            totalMembers={totalMembers}
            showHeatmap={showHeatmap}
            onClick={() => onCellClick(date, time)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create TimeGrid**

Create `src/components/vote/TimeGrid.tsx`:

```typescript
"use client";

import { TIME_SLOTS, getTimeSlotHeatmap } from "@/lib/vote";
import { TimeColumn } from "./TimeColumn";
import type { VoteChoice, TimeSlot } from "@/types";

type TimeGridProps = {
  dates: string[];
  dateChoices: Record<string, VoteChoice | null>;
  isSlotSelected: (date: string, time: string) => boolean;
  pendingStart: { date: string; time: string } | null;
  allTimeSlots: TimeSlot[];
  totalMembers: number;
  showHeatmap: boolean;
  onCellClick: (date: string, time: string) => void;
};

export function TimeGrid({
  dates,
  dateChoices,
  isSlotSelected,
  pendingStart,
  allTimeSlots,
  totalMembers,
  showHeatmap,
  onCellClick,
}: TimeGridProps) {
  return (
    <div className="mx-5 mt-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        시간 선택 · 양끝 클릭으로 구간 선택
      </p>
      <div className="flex gap-0">
        {/* 시간 라벨 열 */}
        <div className="flex-shrink-0 w-12 pt-5">
          {TIME_SLOTS.map((time) => (
            <div
              key={time}
              className="h-8 flex items-center text-xs text-gray-400 dark:text-gray-500"
            >
              {time}
            </div>
          ))}
        </div>

        {/* 날짜별 시간 열 */}
        <div className="flex flex-1 gap-1">
          {dates.map((date) => {
            const choice = dateChoices[date];
            const disabled = choice !== "available";
            const heatmap = showHeatmap
              ? getTimeSlotHeatmap(allTimeSlots, date)
              : {};

            return (
              <div key={date} className="flex-1">
                <TimeColumn
                  date={date}
                  disabled={disabled}
                  isSlotSelected={isSlotSelected}
                  pendingStart={pendingStart}
                  heatmap={heatmap}
                  totalMembers={totalMembers}
                  showHeatmap={showHeatmap}
                  onCellClick={onCellClick}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Delete old components**

Delete these files:
- `src/components/vote/VoteMatrix.tsx`
- `src/components/vote/VoteCell.tsx`
- `src/components/vote/BestDateBanner.tsx`

```bash
rm src/components/vote/VoteMatrix.tsx src/components/vote/VoteCell.tsx src/components/vote/BestDateBanner.tsx
```

- [ ] **Step 7: Run typecheck**

Run: `pnpm typecheck`

Expected: Errors in `GroupDetailClient.tsx` (imports old components) — will be fixed in Task 8.

- [ ] **Step 8: Commit**

```bash
git add src/components/vote/
git commit -m "feat: add time-slot grid components, remove old VoteMatrix"
```

---

## Task 7: Update Mock Data

**Files:**
- Modify: `src/lib/mock/index.ts`

- [ ] **Step 1: Update mock votes to remove maybe and add time slots**

In `src/lib/mock/index.ts`:

1. Remove all `"maybe"` choices from `mockVotes`, replacing with `"available"` or `"unavailable"`.
2. Add `mockTimeSlots` export after `mockVotes`.

Replace `mockVotes`:

```typescript
export const mockVotes: Vote[] = [
  { id: "v1", sessionId: "vs1", userId: "u1", date: "2026-04-25", choice: "available", comment: null },
  { id: "v2", sessionId: "vs1", userId: "u1", date: "2026-04-26", choice: "available", comment: "오후만 가능해요" },
  { id: "v3", sessionId: "vs1", userId: "u1", date: "2026-04-27", choice: "unavailable", comment: null },
  { id: "v4", sessionId: "vs1", userId: "u2", date: "2026-04-25", choice: "available", comment: null },
  { id: "v5", sessionId: "vs1", userId: "u2", date: "2026-04-26", choice: "available", comment: null },
  { id: "v6", sessionId: "vs1", userId: "u2", date: "2026-04-27", choice: "unavailable", comment: null },
  { id: "v7", sessionId: "vs1", userId: "u3", date: "2026-04-25", choice: "available", comment: null },
  { id: "v8", sessionId: "vs1", userId: "u3", date: "2026-04-26", choice: "unavailable", comment: "선약 있어요" },
  { id: "v9", sessionId: "vs1", userId: "u3", date: "2026-04-27", choice: "unavailable", comment: null },
  { id: "v10", sessionId: "vs1", userId: "u10", date: "2026-04-25", choice: "available", comment: null },
  { id: "v11", sessionId: "vs1", userId: "u10", date: "2026-04-26", choice: "available", comment: null },
  { id: "v12", sessionId: "vs1", userId: "u10", date: "2026-04-27", choice: "unavailable", comment: null },
];
```

Add after `mockVotes`:

```typescript
export const mockTimeSlots: TimeSlot[] = [
  // u1: 4/25 14:00~17:00, 4/26 15:00~18:00
  { id: "ts1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "17:00" },
  { id: "ts2", sessionId: "vs1", userId: "u1", date: "2026-04-26", startTime: "15:00", endTime: "18:00" },
  // u2: 4/25 13:00~17:00, 4/26 14:00~17:00
  { id: "ts3", sessionId: "vs1", userId: "u2", date: "2026-04-25", startTime: "13:00", endTime: "17:00" },
  { id: "ts4", sessionId: "vs1", userId: "u2", date: "2026-04-26", startTime: "14:00", endTime: "17:00" },
  // u3: 4/25 14:00~16:00
  { id: "ts5", sessionId: "vs1", userId: "u3", date: "2026-04-25", startTime: "14:00", endTime: "16:00" },
  // u10: 4/25 14:00~18:00, 4/26 14:00~17:00
  { id: "ts6", sessionId: "vs1", userId: "u10", date: "2026-04-25", startTime: "14:00", endTime: "18:00" },
  { id: "ts7", sessionId: "vs1", userId: "u10", date: "2026-04-26", startTime: "14:00", endTime: "17:00" },
];
```

Add `TimeSlot` to the import from `@/types`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/mock/index.ts
git commit -m "feat: update mock data — remove maybe, add time slots"
```

---

## Task 8: Update useVoteRealtime Hook

**Files:**
- Modify: `src/hooks/useVoteRealtime.ts`

- [ ] **Step 1: Add time_slots channel subscription**

Rewrite `src/hooks/useVoteRealtime.ts` to return both votes and time slots:

```typescript
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { mapVote, mapTimeSlot } from "@/lib/mappers";
import type { Vote, TimeSlot } from "@/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type VoteRow = Database["public"]["Tables"]["votes"]["Row"];

export function useVoteRealtime(
  sessionId: string,
  initialVotes: Vote[],
  initialTimeSlots: TimeSlot[] = []
): { votes: Vote[]; timeSlots: TimeSlot[] } {
  const [votes, setVotes] = useState<Vote[]>(initialVotes);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(initialTimeSlots);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`vote-all:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<VoteRow>) => {
          if (payload.eventType === "INSERT") {
            setVotes((prev) => [...prev, mapVote(payload.new)]);
          } else if (payload.eventType === "UPDATE") {
            setVotes((prev) =>
              prev.map((v) =>
                v.id === payload.new.id ? mapVote(payload.new) : v
              )
            );
          } else if (payload.eventType === "DELETE") {
            setVotes((prev) =>
              prev.filter((v) => v.id !== payload.old.id)
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_slots",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as { id: string; session_id: string; user_id: string; date: string; start_time: string; end_time: string };
            setTimeSlots((prev) => [...prev, mapTimeSlot(row)]);
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setTimeSlots((prev) =>
              prev.filter((s) => s.id !== old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { votes, timeSlots };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useVoteRealtime.ts
git commit -m "feat: add time_slots realtime subscription to useVoteRealtime"
```

---

## Task 9: GroupDetailClient Integration

**Files:**
- Modify: `src/app/group/[id]/GroupDetailClient.tsx` (full rewrite of vote section)
- Modify: `src/app/group/[id]/page.tsx` (pass initialTimeSlots)
- Modify: `src/components/vote/StickyConfirmButton.tsx` (show time info)

- [ ] **Step 1: Update page.tsx to fetch time slots**

In `src/app/group/[id]/page.tsx`, after fetching `initialVotes` (around line 103–108), add time slots fetch:

```typescript
  // Fetch initial time slots
  const { data: timeSlotsData } = await supabase
    .from("time_slots")
    .select("*")
    .eq("session_id", sessionRow.id);

  const initialTimeSlots: TimeSlot[] = (timeSlotsData ?? []).map(mapTimeSlot);
```

Update the `GroupDetailClient` render to pass `initialTimeSlots`:

```tsx
  return (
    <GroupDetailClient
      group={group}
      voteSession={voteSession}
      initialVotes={initialVotes}
      initialTimeSlots={initialTimeSlots}
      currentUserId={user.id}
    />
  );
```

Also pass `initialTimeSlots={[]}` for mock groups and no-session cases.

Add `mapTimeSlot` to the imports from `@/lib/mappers` and `TimeSlot` to the imports from `@/types`.

- [ ] **Step 2: Rewrite GroupDetailClient.tsx**

Replace the entire file `src/app/group/[id]/GroupDetailClient.tsx`:

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DateToggleRow } from "@/components/vote/DateToggleRow";
import { BestTimeBanner } from "@/components/vote/BestTimeBanner";
import { TimeGrid } from "@/components/vote/TimeGrid";
import { StickyConfirmButton } from "@/components/vote/StickyConfirmButton";
import { CommentSection } from "@/components/vote/CommentSection";
import { useVoteRealtime } from "@/hooks/useVoteRealtime";
import { useTimeSlotSelection } from "@/hooks/useTimeSlotSelection";
import { getBestDate, getBestTimeSlot, isAllVoted } from "@/lib/vote";
import { mockUsers, mockCurrentUserId, mockTimeSlots } from "@/lib/mock";
import type { Vote, VoteChoice, VoteSession, Group, User, TimeSlot } from "@/types";
import { ChevronLeft } from "lucide-react";

type MockNewData = {
  name: string;
  memberIds: string[];
  candidateDates: string[];
  deadline: string | null;
};

function readMockNewData(): MockNewData | null {
  try {
    const raw = sessionStorage.getItem("mock-new-group");
    if (!raw) return null;
    return JSON.parse(raw) as MockNewData;
  } catch {
    return null;
  }
}

type Props = {
  group: Group;
  voteSession: VoteSession | null;
  initialVotes: Vote[];
  initialTimeSlots?: TimeSlot[];
  currentUserId: string;
};

/** 날짜 투표를 순환: null → available → unavailable → null */
function cycleDateChoice(current: VoteChoice | null): VoteChoice | null {
  if (current === null) return "available";
  if (current === "available") return "unavailable";
  return null;
}

export function GroupDetailClient({
  group: defaultGroup,
  voteSession: defaultSession,
  initialVotes: defaultVotes,
  initialTimeSlots: defaultTimeSlots = [],
  currentUserId,
}: Props) {
  const router = useRouter();
  const isMock = defaultGroup.id.startsWith("mock-");

  // mock-new: sessionStorage에서 사용자 입력 데이터로 오버라이드
  const [{ group, voteSession, initialVotes, initialTimeSlots }] = useState(() => {
    if (defaultGroup.id !== "mock-new") {
      return {
        group: defaultGroup,
        voteSession: defaultSession,
        initialVotes: defaultVotes,
        initialTimeSlots: defaultTimeSlots,
      };
    }
    const saved = readMockNewData();
    if (!saved) {
      return {
        group: defaultGroup,
        voteSession: defaultSession,
        initialVotes: defaultVotes,
        initialTimeSlots: defaultTimeSlots,
      };
    }

    const allMock = mockUsers;
    const me = allMock.find((u) => u.id === mockCurrentUserId);
    const selectedMembers: User[] = saved.memberIds
      .map((id) => allMock.find((u) => u.id === id))
      .filter((u): u is User => u !== undefined);
    if (me && !selectedMembers.some((m) => m.id === me.id)) {
      selectedMembers.unshift(me);
    }

    const newGroup: Group = {
      ...defaultGroup,
      name: saved.name,
      members: selectedMembers.length > 0 ? selectedMembers : defaultGroup.members,
    };

    const newSession: VoteSession = {
      id: "vs-new",
      groupId: "mock-new",
      candidateDates: saved.candidateDates,
      deadline: saved.deadline ?? "",
    };

    return { group: newGroup, voteSession: newSession, initialVotes: [] as Vote[], initialTimeSlots: [] as TimeSlot[] };
  });

  // Realtime (production)
  const { votes: realtimeVotes, timeSlots: realtimeTimeSlots } = useVoteRealtime(
    voteSession?.id ?? "",
    initialVotes,
    initialTimeSlots
  );

  // Mock 로컬 상태
  const [localVotes, setLocalVotes] = useState<Vote[]>(initialVotes);
  const [localTimeSlots, setLocalTimeSlots] = useState<TimeSlot[]>(
    isMock && defaultGroup.id !== "mock-new" ? mockTimeSlots : initialTimeSlots
  );
  const [confirmed, setConfirmed] = useState(group.status === "confirmed");

  const votes = isMock ? localVotes : realtimeVotes;
  const allTimeSlots = isMock ? localTimeSlots : realtimeTimeSlots;

  // 날짜 O/X 선택 상태: 현재 유저의 vote에서 파생
  const [dateChoices, setDateChoices] = useState<Record<string, VoteChoice | null>>(() => {
    const map: Record<string, VoteChoice | null> = {};
    if (voteSession) {
      voteSession.candidateDates.forEach((d) => {
        const v = initialVotes.find((vote) => vote.userId === currentUserId && vote.date === d);
        map[d] = v?.choice ?? null;
      });
    }
    return map;
  });

  // 시간 슬롯 선택 (현재 유저의 것만)
  const myInitialSlots = (isMock ? localTimeSlots : initialTimeSlots).filter(
    (s) => s.userId === currentUserId
  );
  const {
    state: selectionState,
    pendingStart,
    handleCellClick,
    isSlotSelected,
    getSelectedRanges,
  } = useTimeSlotSelection(myInitialSlots);

  // 날짜 토글 핸들러
  const handleDateToggle = useCallback(
    async (date: string) => {
      const current = dateChoices[date] ?? null;
      const next = cycleDateChoice(current);

      setDateChoices((prev) => ({ ...prev, [date]: next }));

      if (!voteSession) return;

      if (isMock) {
        if (next === null) {
          // 미선택: 투표 제거
          setLocalVotes((prev) =>
            prev.filter((v) => !(v.userId === currentUserId && v.date === date))
          );
        } else {
          setLocalVotes((prev) => {
            const idx = prev.findIndex(
              (v) => v.userId === currentUserId && v.date === date
            );
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], choice: next };
              return updated;
            }
            return [
              ...prev,
              {
                id: `local-${Date.now()}`,
                sessionId: voteSession.id,
                userId: currentUserId,
                date,
                choice: next,
                comment: null,
              },
            ];
          });
        }
        return;
      }

      // Production
      if (next === null) {
        // TODO: DELETE vote endpoint (not in current API — skip for MVP)
        return;
      }

      const existing = votes.find(
        (v) => v.userId === currentUserId && v.date === date
      );
      const method = existing ? "PATCH" : "POST";
      await fetch(`/api/vote-sessions/${voteSession.id}/votes`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, choice: next }),
      });
    },
    [dateChoices, voteSession, isMock, currentUserId, votes]
  );

  // 시간 슬롯 저장: 셀 클릭 후 rangeComplete로 돌아올 때마다 서버 동기화
  const handleTimeSlotClick = useCallback(
    (date: string, time: string) => {
      handleCellClick(date, time);
    },
    [handleCellClick]
  );

  // selectionState가 idle로 돌아오면 (range 완성 or 해제 후) 서버에 저장
  useEffect(() => {
    if (selectionState !== "idle" || !voteSession) return;

    if (isMock) {
      // Mock: 로컬 time slots 갱신
      const dates = voteSession.candidateDates;
      const newSlots: TimeSlot[] = [];
      for (const date of dates) {
        const ranges = getSelectedRanges(date);
        for (const range of ranges) {
          newSlots.push({
            id: `local-ts-${date}-${range.startTime}`,
            sessionId: voteSession.id,
            userId: currentUserId,
            date,
            startTime: range.startTime,
            endTime: range.endTime,
          });
        }
      }
      setLocalTimeSlots((prev) => [
        ...prev.filter((s) => s.userId !== currentUserId),
        ...newSlots,
      ]);
      return;
    }

    // Production: PUT per changed date
    // (Simplified — save all dates)
    const dates = voteSession.candidateDates;
    for (const date of dates) {
      const ranges = getSelectedRanges(date);
      fetch(`/api/vote-sessions/${voteSession.id}/time-slots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          slots: ranges.map((r) => ({
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        }),
      });
    }
  }, [selectionState, voteSession, isMock, currentUserId, getSelectedRanges]);

  // 확정 핸들러
  const handleConfirm = useCallback(async () => {
    if (!voteSession) return;
    const bestDate = getBestDate(voteSession, votes);
    if (!bestDate) return;

    const activeDates = voteSession.candidateDates.filter(
      (d) => {
        const v = votes.find((vote) => vote.date === d && vote.choice === "available");
        return !!v;
      }
    );
    const best = getBestTimeSlot(allTimeSlots, activeDates);

    if (isMock) {
      setConfirmed(true);
      return;
    }

    await fetch(`/api/groups/${group.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmedDate: bestDate,
        confirmedStartTime: best?.startTime,
        confirmedEndTime: best?.endTime,
      }),
    });
    router.refresh();
  }, [voteSession, votes, allTimeSlots, isMock, group.id, router]);

  // 파생 상태
  const bestDate = voteSession ? getBestDate(voteSession, votes) : null;
  const memberIds = group.members.map((m) => m.id);
  const allVoted = voteSession ? isAllVoted(voteSession, votes, memberIds) : false;
  const isHost = group.hostId === currentUserId;

  const activeDates = voteSession
    ? voteSession.candidateDates.filter((d) => {
        const choice = dateChoices[d];
        return choice === "available";
      })
    : [];
  const bestTime = getBestTimeSlot(allTimeSlots, activeDates);

  // 히트맵 표시: 전원 투표 완료 시
  const showHeatmap = allVoted && allTimeSlots.length > 0;

  return (
    <div className="bg-gray-50 min-h-dvh pb-[140px] dark:bg-gray-950">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <button
          onClick={() => router.back()}
          aria-label="뒤로"
          className="min-h-11 min-w-11 flex items-center justify-center -ml-2"
        >
          <ChevronLeft
            size={24}
            className="text-gray-700 dark:text-gray-300"
            strokeWidth={1.5}
          />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {group.name}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {group.members.length}명 참여
          </p>
        </div>
      </div>

      {confirmed ? (
        <div className="px-5 mt-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 px-6 py-4">
            <span className="text-2xl">🎉</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                일정이 확정되었어요!
              </p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {bestDate}
                {bestTime && ` ${bestTime.startTime}~${bestTime.endTime}`}
              </p>
            </div>
          </div>
        </div>
      ) : voteSession ? (
        <>
          {/* 날짜 선택 행 */}
          <div className="px-5 mt-4">
            <DateToggleRow
              dates={voteSession.candidateDates}
              choices={dateChoices}
              onToggle={handleDateToggle}
            />
          </div>

          {/* 최적 시간대 배너 */}
          <BestTimeBanner
            date={bestTime?.date ?? null}
            startTime={bestTime?.startTime ?? null}
            endTime={bestTime?.endTime ?? null}
            count={bestTime?.count ?? 0}
            totalMembers={group.members.length}
          />

          {/* 시간 그리드 */}
          <TimeGrid
            dates={voteSession.candidateDates}
            dateChoices={dateChoices}
            isSlotSelected={isSlotSelected}
            pendingStart={pendingStart}
            allTimeSlots={allTimeSlots}
            totalMembers={group.members.length}
            showHeatmap={showHeatmap}
            onCellClick={handleTimeSlotClick}
          />

          {/* 코멘트 */}
          <CommentSection votes={votes} members={group.members} />

          {/* 확정 버튼 */}
          <StickyConfirmButton
            allVoted={allVoted}
            isHost={isHost}
            onConfirm={handleConfirm}
          />
        </>
      ) : (
        <p className="px-5 mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          투표 세션이 없습니다.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

Fix any type errors.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`

Fix any lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/group/\[id\]/GroupDetailClient.tsx src/app/group/\[id\]/page.tsx src/components/vote/StickyConfirmButton.tsx
git commit -m "feat: integrate time-slot voting into GroupDetailClient"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`

Expected: No errors.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: No errors.

- [ ] **Step 3: Run all tests**

Run: `pnpm test`

Expected: All tests pass.

- [ ] **Step 4: Start dev server and verify mock group**

Run: `pnpm dev`

Navigate to `http://localhost:3000/group/mock-g1`:
1. Verify DateToggleRow shows 3 dates with O/X toggles
2. Toggle a date — verify it cycles null → O → X → null
3. X dates should disable that column in the grid
4. Click two cells in an O column — verify range is highlighted violet
5. Click inside a selected range — verify it deselects
6. Verify BestTimeBanner shows the optimal overlap time
7. Verify the layout matches the spec mockup

- [ ] **Step 5: Verify mock-new flow**

Navigate to create a new group (home → 모임 만들기), then verify the voting view loads with empty state and allows interaction.

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final adjustments for time-slot voting"
```
