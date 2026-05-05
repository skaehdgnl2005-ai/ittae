# Guest Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비회원이 호스트가 공유한 `/g/<8자리코드>` 링크로 들어와 닉네임만 입력하고 모임 시간 투표에 참여할 수 있게 한다.

**Architecture:** 별도 `group_guests` 테이블(닉네임 + 브라우저 토큰)을 만들고, 기존 `votes`/`time_slots`에 `guest_id`를 nullable로 추가해 회원/게스트가 같은 테이블에서 분기되도록 한다. 게스트 API는 모두 `/api/invite/[code]/...`에 두고 server-side service-role client로 처리(anon RLS 안 풂). 호스트 화면은 회원+게스트 합산 표시.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS + Realtime), TypeScript, Tailwind, shadcn/ui.

---

## Spec Reference

See: `docs/superpowers/specs/2026-05-05-guest-voting-design.md`

## Files Touched

**New:**
- `supabase/migrations/008_guest_voting.sql`
- `scripts/backfill-invite-codes.ts`
- `src/lib/inviteCode.ts`
- `src/lib/guest.ts`
- `src/lib/api/guest.ts`
- `src/lib/supabase/guestAuth.ts` (`requireGuest` 헬퍼)
- `src/app/api/invite/[code]/route.ts`
- `src/app/api/invite/[code]/guests/route.ts`
- `src/app/api/invite/[code]/state/route.ts`
- `src/app/api/invite/[code]/votes/route.ts`
- `src/app/api/invite/[code]/time-slots/route.ts`
- `src/app/g/[code]/page.tsx`
- `src/app/g/[code]/GuestVoteClient.tsx`
- `src/components/vote/GuestNicknameModal.tsx`
- `src/hooks/useGuestRealtime.ts`

**Modified:**
- `src/types/index.ts` — Guest 타입, Vote/TimeSlot에 `guestId`
- `src/lib/mappers.ts` — mapGuest, mapVote/mapTimeSlot에 guest_id 매핑
- `src/lib/routes.ts` — `INVITE_GROUP(code)`, PUBLIC_PATHS에 `/g/`, `/api/invite/`
- `src/app/api/groups/route.ts` — POST에서 invite_code 자동 발급
- `src/app/group/[id]/page.tsx` — group_guests 함께 fetch, members에 합쳐서 전달
- `src/app/group/[id]/GroupDetailClient.tsx` — handleCopyLink가 invite link 복사, 매트릭스에 게스트 합산
- `src/components/vote/CommentSection.tsx` — 게스트 행은 댓글 없음
- `src/components/vote/TimeGrid.tsx`, `BestTimeBanner.tsx` 등 — `othersTotal` 계산에 게스트 포함
- `middleware.ts` — PUBLIC_PATHS에 신규 경로 추가됨 (routes.ts 변경으로 자동 반영)

---

## Task 1: 마이그레이션 008 (스키마 변경)

**Files:**
- Create: `supabase/migrations/008_guest_voting.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- ============================================================
-- 008_guest_voting.sql
-- 비회원 모임 투표(guest voting) — invite_code, group_guests, votes/time_slots에 guest_id
-- ============================================================

-- 1. groups에 invite_code 컬럼
alter table groups add column invite_code text unique;

-- 2. group_guests 테이블
create table group_guests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade not null,
  nickname text not null,
  browser_token text not null,
  created_at timestamptz default now(),
  unique(group_id, browser_token)
);

alter table group_guests enable row level security;

-- SELECT: 그룹 멤버는 그 그룹 게스트 조회 가능
create policy "group_guests_select_member" on group_guests
  for select using (
    group_id in (select group_id from group_members where user_id = auth.uid())
  );
-- INSERT/UPDATE/DELETE는 service role에서만 처리 (anon/authenticated 정책 없음)

-- 3. votes에 guest_id (XOR with user_id)
alter table votes add column guest_id uuid references group_guests(id) on delete cascade;
alter table votes alter column user_id drop not null;
alter table votes add constraint votes_voter_xor check (
  (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
);

-- 기존 unique(session_id, user_id, date) 제거 → partial unique index로 분리
alter table votes drop constraint votes_session_id_user_id_date_key;
create unique index votes_member_unique on votes(session_id, user_id, date)
  where user_id is not null;
create unique index votes_guest_unique on votes(session_id, guest_id, date)
  where guest_id is not null;

-- 4. time_slots에 guest_id (XOR with user_id)
alter table time_slots add column guest_id uuid references group_guests(id) on delete cascade;
alter table time_slots alter column user_id drop not null;
alter table time_slots add constraint time_slots_voter_xor check (
  (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
);

-- time_slots도 partial unique (기존 unique constraint를 분리)
alter table time_slots drop constraint if exists time_slots_unique;
create unique index time_slots_member_unique
  on time_slots(session_id, user_id, date, start_time)
  where user_id is not null;
create unique index time_slots_guest_unique
  on time_slots(session_id, guest_id, date, start_time)
  where guest_id is not null;

-- 5. group_guests를 supabase_realtime publication에 추가
do $$
begin
  alter publication supabase_realtime add table group_guests;
exception
  when duplicate_object then null;
end $$;
```

- [ ] **Step 2: Supabase에 적용**

이 단계는 사용자가 직접 Supabase Dashboard SQL Editor에서 실행. (Plan 본문에 안내)

- [ ] **Step 3: pnpm db:types 실행**

```bash
pnpm db:types
```

새 컬럼(`invite_code`, `votes.guest_id`, `time_slots.guest_id`)과 새 테이블(`group_guests`)이 `src/types/supabase.ts`에 반영된다.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_guest_voting.sql src/types/supabase.ts
git commit -m "feat(db): 008_guest_voting — invite_code + group_guests + votes/time_slots guest_id"
```

---

## Task 2: invite_code 발급 유틸 + 백필

**Files:**
- Create: `src/lib/inviteCode.ts`
- Create: `scripts/backfill-invite-codes.ts`

- [ ] **Step 1: inviteCode 유틸**

```ts
// src/lib/inviteCode.ts
// 시각적 모호 문자(0/O/1/I) 제외한 32자.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}
```

- [ ] **Step 2: 백필 스크립트**

```ts
// scripts/backfill-invite-codes.ts
import { createClient } from "@supabase/supabase-js";
import { generateInviteCode } from "../src/lib/inviteCode";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: groups, error } = await supabase
    .from("groups")
    .select("id")
    .is("invite_code", null);
  if (error) throw error;
  if (!groups || groups.length === 0) {
    console.log("no groups need backfill");
    return;
  }

  for (const g of groups) {
    let attempt = 0;
    while (attempt < 10) {
      const code = generateInviteCode(8);
      const { error: updError } = await supabase
        .from("groups")
        .update({ invite_code: code })
        .eq("id", g.id)
        .is("invite_code", null);
      if (!updError) {
        console.log(`group ${g.id} -> ${code}`);
        break;
      }
      attempt++;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: 백필 실행**

```bash
pnpm exec tsx scripts/backfill-invite-codes.ts
```

(tsx가 devDependency에 없으면 일단 스킵 — 새 모임만 발급되도록 Task 3에서 처리.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/inviteCode.ts scripts/backfill-invite-codes.ts
git commit -m "feat(invite): 8자 invite_code 생성 유틸 + 백필 스크립트"
```

---

## Task 3: 모임 생성 시 invite_code 자동 발급

**Files:**
- Modify: `src/app/api/groups/route.ts:74-117` (POST 핸들러)

- [ ] **Step 1: POST에서 invite_code 발급해서 insert**

`src/app/api/groups/route.ts`의 POST 핸들러 — `groups.insert` 직전에 코드 발급, insert payload에 포함, 충돌 시 재시도.

```ts
// 상단 import에 추가
import { generateInviteCode } from "@/lib/inviteCode";

// POST 함수 내 — 기존 const { data: group, error: groupError } = await supabase.from("groups").insert(...) 부분 교체
let group: { id: string; name: string; host_id: string; status: string; confirmed_date: string | null; place_id: string | null; created_at: string; invite_code: string | null } | null = null;
let groupError: { message: string } | null = null;

for (let attempt = 0; attempt < 5; attempt++) {
  const code = generateInviteCode(8);
  const result = await supabase
    .from("groups")
    .insert({
      name: body.name.trim(),
      host_id: user.id,
      status: "voting",
      invite_code: code,
    })
    .select()
    .single();

  if (!result.error) {
    group = result.data;
    groupError = null;
    break;
  }
  // 23505 = unique_violation. invite_code 충돌이면 재시도.
  if (result.error.code === "23505" && result.error.message.includes("invite_code")) {
    continue;
  }
  groupError = result.error;
  break;
}

if (groupError || !group) {
  return NextResponse.json(
    { error: groupError?.message ?? "Failed to create group" },
    { status: 500 }
  );
}
```

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

기대: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/groups/route.ts
git commit -m "feat(api): POST /api/groups — invite_code 자동 발급(충돌 시 재시도)"
```

---

## Task 4: 타입 + mappers + routes 업데이트

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/mappers.ts`
- Modify: `src/lib/routes.ts`

- [ ] **Step 1: types**

`src/types/index.ts`에 추가:

```ts
export type Guest = {
  id: string;
  groupId: string;
  nickname: string;
  createdAt: string;
};

export type Member =
  | { kind: "user"; user: User }
  | { kind: "guest"; guest: Guest };
```

`Group`, `Vote`, `TimeSlot` 수정:

```ts
export type Group = {
  id: string;
  name: string;
  hostId: string;
  status: GroupStatus;
  confirmedDate: string | null;
  placeId: string | null;
  createdAt: string;
  inviteCode: string | null;
  members: User[];
  guests: Guest[];
};

export type Vote = {
  id: string;
  sessionId: string;
  userId: string | null;
  guestId: string | null;
  date: string;
  choice: VoteChoice;
  comment: string | null;
};

export type TimeSlot = {
  id: string;
  sessionId: string;
  userId: string | null;
  guestId: string | null;
  date: string;
  startTime: string;
  endTime: string;
};
```

- [ ] **Step 2: mappers**

`src/lib/mappers.ts`:

```ts
// import 추가
import type { ..., Guest } from "@/types";

// mapGroup 수정 — inviteCode + guests 추가
export function mapGroup(
  row: Database["public"]["Tables"]["groups"]["Row"]
): Group {
  return {
    id: row.id,
    name: row.name,
    hostId: row.host_id,
    status: row.status,
    confirmedDate: row.confirmed_date,
    placeId: row.place_id,
    createdAt: row.created_at,
    inviteCode: row.invite_code ?? null,
    members: [],
    guests: [],
  };
}

// mapVote 수정
export function mapVote(
  row: Database["public"]["Tables"]["votes"]["Row"]
): Vote {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    guestId: row.guest_id ?? null,
    date: row.date,
    choice: row.choice as Vote["choice"],
    comment: row.comment,
  };
}

// mapTimeSlot 수정 (구조 동일하게 guest_id 추가)
export function mapTimeSlot(
  row: { id: string; session_id: string; user_id: string | null; guest_id: string | null; date: string; start_time: string; end_time: string }
): TimeSlot {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    guestId: row.guest_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

// mapGuest 신규
type GuestRow = {
  id: string;
  group_id: string;
  nickname: string;
  created_at: string;
};

export function mapGuest(row: GuestRow): Guest {
  return {
    id: row.id,
    groupId: row.group_id,
    nickname: row.nickname,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 3: routes**

`src/lib/routes.ts`:

```ts
export const ROUTES = {
  HOME: "/home",
  LOGIN: "/login",
  AUTH_CALLBACK: "/auth/callback",
  AUTH_CALLBACK_KAKAO: "/auth/callback/kakao",
  PROFILE_SETUP: "/profile/setup",
  INVITE: (code: string) => `/i/${code}`,
  GUEST_GROUP: (code: string) => `/g/${code}`,
} as const;

export const PUBLIC_PATHS = [
  ROUTES.LOGIN,
  "/auth",
  "/g/",
  "/api/invite/",
] as const;
```

- [ ] **Step 4: typecheck — 기존 사용처 깨진 곳 수정**

```bash
pnpm typecheck
```

기대: `userId`가 `string | null`이 되면서 기존 코드 일부 break. 가능한 break 지점:
- `GroupDetailClient.tsx:52` — `vote.userId === currentUserId` (null 비교는 false라 안전) — 그대로 OK
- `GroupDetailClient.tsx:213` — `s.userId !== currentUserId` — userId가 null이면 true가 되므로 게스트 슬롯도 "다른 사람"에 포함됨, 의도와 일치. OK
- `useTimeSlotSelection` — `s.userId === currentUserId` 필터 (file 위치 확인 후 동일한 패턴이면 OK)

깨지는 곳을 일일이 수정하기보다, 먼저 컴파일 통과만 확인하고, 의미상 변경이 필요한 곳은 Task 11에서 게스트 합산 시 처리.

기존 멤버 카운트(`group.members.length`)도 game-changing이므로 Task 11에서 통일.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/mappers.ts src/lib/routes.ts
git commit -m "feat(types): Guest/Member 타입 + Vote/TimeSlot guestId + GUEST_GROUP route + PUBLIC_PATHS 추가"
```

---

## Task 5: 게스트 식별 인프라 (localStorage + fetch wrapper + requireGuest)

**Files:**
- Create: `src/lib/guest.ts`
- Create: `src/lib/api/guest.ts`
- Create: `src/lib/supabase/guestAuth.ts`

- [ ] **Step 1: localStorage 헬퍼**

```ts
// src/lib/guest.ts
"use client";

const TOKEN_KEY = (groupId: string) => `guest-token:${groupId}`;
const NICK_KEY = (groupId: string) => `guest-nick:${groupId}`;

export function getGuestToken(groupId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY(groupId));
}

export function setGuestToken(groupId: string, token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY(groupId), token);
}

export function getGuestNickname(groupId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NICK_KEY(groupId));
}

export function setGuestNickname(groupId: string, nickname: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NICK_KEY(groupId), nickname);
}

export function generateBrowserToken(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 2: fetch wrapper**

```ts
// src/lib/api/guest.ts
"use client";

export async function guestFetch(
  url: string,
  options: RequestInit & { token: string }
): Promise<Response> {
  const { token, headers, ...rest } = options;
  return fetch(url, {
    ...rest,
    headers: {
      ...(headers ?? {}),
      "Content-Type": "application/json",
      "x-guest-token": token,
    },
  });
}
```

- [ ] **Step 3: requireGuest 헬퍼 (server-side)**

```ts
// src/lib/supabase/guestAuth.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type GuestSuccess = {
  guestId: string;
  groupId: string;
  nickname: string;
  error: null;
};
type GuestFailure = { error: NextResponse };

export async function requireGuest(
  request: Request,
  inviteCode: string
): Promise<GuestSuccess | GuestFailure> {
  const token = request.headers.get("x-guest-token");
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing guest token" },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();

  // invite_code -> group_id
  const { data: group, error: groupError } = await admin
    .from("groups")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (groupError || !group) {
    return {
      error: NextResponse.json({ error: "Invalid invite code" }, { status: 404 }),
    };
  }

  // guest by (group_id, browser_token)
  const { data: guest, error: guestError } = await admin
    .from("group_guests")
    .select("id, nickname")
    .eq("group_id", group.id)
    .eq("browser_token", token)
    .maybeSingle();

  if (guestError || !guest) {
    return {
      error: NextResponse.json({ error: "Guest not found" }, { status: 401 }),
    };
  }

  return {
    guestId: guest.id,
    groupId: group.id,
    nickname: guest.nickname,
    error: null,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/guest.ts src/lib/api/guest.ts src/lib/supabase/guestAuth.ts
git commit -m "feat(guest): localStorage 토큰 헬퍼 + guestFetch + requireGuest"
```

---

## Task 6: API — GET /api/invite/[code] (코드 검증)

**Files:**
- Create: `src/app/api/invite/[code]/route.ts`

- [ ] **Step 1: 라우트 작성**

```ts
// src/app/api/invite/[code]/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { code } = await params;
  const admin = createAdminClient();

  const { data: group, error } = await admin
    .from("groups")
    .select("id, name, status, confirmed_date, confirmed_start_time, confirmed_end_time")
    .eq("invite_code", code)
    .maybeSingle();

  if (error || !group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      groupId: group.id,
      name: group.name,
      status: group.status,
      confirmedDate: group.confirmed_date,
      confirmedStartTime: (group as { confirmed_start_time: string | null }).confirmed_start_time ?? null,
      confirmedEndTime: (group as { confirmed_end_time: string | null }).confirmed_end_time ?? null,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/invite/[code]/route.ts
git commit -m "feat(api): GET /api/invite/[code] — 코드 검증 + group meta 응답"
```

---

## Task 7: API — POST /api/invite/[code]/guests (게스트 등록)

**Files:**
- Create: `src/app/api/invite/[code]/guests/route.ts`

- [ ] **Step 1: 라우트 작성**

```ts
// src/app/api/invite/[code]/guests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const body: { nickname: string; browserToken: string } = await request.json();

  if (!body.nickname?.trim() || !body.browserToken) {
    return NextResponse.json(
      { error: "nickname and browserToken required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 1. invite_code -> group_id
  const { data: group, error: groupErr } = await admin
    .from("groups")
    .select("id, status")
    .eq("invite_code", code)
    .maybeSingle();
  if (groupErr || !group) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }
  if (group.status !== "voting") {
    return NextResponse.json(
      { error: "이 모임은 더 이상 투표를 받지 않아요" },
      { status: 409 }
    );
  }

  // 2. 같은 (group_id, browser_token) 있으면 그대로 반환
  const { data: existing } = await admin
    .from("group_guests")
    .select("id, nickname")
    .eq("group_id", group.id)
    .eq("browser_token", body.browserToken)
    .maybeSingle();

  if (existing) {
    // 닉네임 변경 시 업데이트
    if (existing.nickname !== body.nickname.trim()) {
      await admin
        .from("group_guests")
        .update({ nickname: body.nickname.trim() })
        .eq("id", existing.id);
    }
    return NextResponse.json({
      data: { guestId: existing.id, nickname: body.nickname.trim() },
    });
  }

  // 3. 신규 등록
  const { data: inserted, error: insErr } = await admin
    .from("group_guests")
    .insert({
      group_id: group.id,
      nickname: body.nickname.trim(),
      browser_token: body.browserToken,
    })
    .select("id, nickname")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: insErr?.message ?? "Failed to create guest" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { data: { guestId: inserted.id, nickname: inserted.nickname } },
    { status: 201 }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/invite/[code]/guests/route.ts
git commit -m "feat(api): POST /api/invite/[code]/guests — 게스트 등록(중복 토큰 idempotent)"
```

---

## Task 8: API — GET /api/invite/[code]/state (게스트 시점 데이터)

**Files:**
- Create: `src/app/api/invite/[code]/state/route.ts`

- [ ] **Step 1: 라우트 작성**

게스트 화면이 mount 시 호출. 그룹 + 최신 vote_session + 모든 votes + 모든 time_slots + 모든 members + 모든 guests + 본인 guest 정보를 응답.

```ts
// src/app/api/invite/[code]/state/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGuest } from "@/lib/supabase/guestAuth";
import { mapGroup, mapVoteSession, mapVote, mapTimeSlot, mapUser, mapGuest } from "@/lib/mappers";

type Params = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: Params) {
  const { code } = await params;
  const auth = await requireGuest(request, code);
  if ("error" in auth && auth.error) return auth.error;
  const { groupId, guestId } = auth as { groupId: string; guestId: string };

  const admin = createAdminClient();

  const [
    { data: groupRow },
    { data: sessionRow },
    { data: memberships },
    { data: guests },
  ] = await Promise.all([
    admin.from("groups").select("*").eq("id", groupId).maybeSingle(),
    admin
      .from("vote_sessions")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("group_members").select("user_id").eq("group_id", groupId),
    admin.from("group_guests").select("*").eq("group_id", groupId),
  ]);

  if (!groupRow) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const memberIds = (memberships ?? []).map((m) => m.user_id);
  const { data: users } = memberIds.length
    ? await admin.from("users").select("*").in("id", memberIds)
    : { data: [] };

  let votes: ReturnType<typeof mapVote>[] = [];
  let timeSlots: ReturnType<typeof mapTimeSlot>[] = [];
  if (sessionRow) {
    const [{ data: voteRows }, { data: tsRows }] = await Promise.all([
      admin.from("votes").select("*").eq("session_id", sessionRow.id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any).from("time_slots").select("*").eq("session_id", sessionRow.id),
    ]);
    votes = (voteRows ?? []).map(mapVote);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    timeSlots = ((tsRows ?? []) as any[]).map(mapTimeSlot);
  }

  return NextResponse.json({
    data: {
      group: {
        ...mapGroup(groupRow),
        members: (users ?? []).map(mapUser),
        guests: (guests ?? []).map(mapGuest),
      },
      voteSession: sessionRow ? mapVoteSession(sessionRow) : null,
      votes,
      timeSlots,
      currentGuestId: guestId,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/invite/[code]/state/route.ts
git commit -m "feat(api): GET /api/invite/[code]/state — 게스트 시점 합본 응답"
```

---

## Task 9: API — POST/PATCH /api/invite/[code]/votes + PUT /time-slots

**Files:**
- Create: `src/app/api/invite/[code]/votes/route.ts`
- Create: `src/app/api/invite/[code]/time-slots/route.ts`

- [ ] **Step 1: votes 라우트**

```ts
// src/app/api/invite/[code]/votes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGuest } from "@/lib/supabase/guestAuth";
import { mapVote } from "@/lib/mappers";
import type { VoteChoice } from "@/types";

type Params = { params: Promise<{ code: string }> };

async function findSessionId(code: string, groupId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vote_sessions")
    .select("id")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function checkVotingOpen(groupId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("groups")
    .select("status")
    .eq("id", groupId)
    .maybeSingle();
  return data?.status === "voting";
}

export async function POST(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const auth = await requireGuest(request, code);
  if ("error" in auth && auth.error) return auth.error;
  const { guestId, groupId } = auth as { guestId: string; groupId: string };

  if (!(await checkVotingOpen(groupId))) {
    return NextResponse.json({ error: "모임이 마감되었어요" }, { status: 409 });
  }

  const body: { date: string; choice: string } = await request.json();
  if (body.choice === "maybe") {
    return NextResponse.json({ error: "maybe choice not supported" }, { status: 400 });
  }

  const sessionId = await findSessionId(code, groupId);
  if (!sessionId) {
    return NextResponse.json({ error: "No vote session" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: vote, error } = await admin
    .from("votes")
    .insert({
      session_id: sessionId,
      user_id: null,
      guest_id: guestId,
      date: body.date,
      choice: body.choice as VoteChoice,
      comment: null,
    })
    .select()
    .single();

  if (error || !vote) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ data: mapVote(vote) }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const auth = await requireGuest(request, code);
  if ("error" in auth && auth.error) return auth.error;
  const { guestId, groupId } = auth as { guestId: string; groupId: string };

  if (!(await checkVotingOpen(groupId))) {
    return NextResponse.json({ error: "모임이 마감되었어요" }, { status: 409 });
  }

  const body: { date: string; choice: string } = await request.json();
  const sessionId = await findSessionId(code, groupId);
  if (!sessionId) {
    return NextResponse.json({ error: "No vote session" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: vote, error } = await admin
    .from("votes")
    .update({ choice: body.choice as VoteChoice })
    .eq("session_id", sessionId)
    .eq("guest_id", guestId)
    .eq("date", body.date)
    .select()
    .single();

  if (error || !vote) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ data: mapVote(vote) });
}
```

- [ ] **Step 2: time-slots 라우트**

```ts
// src/app/api/invite/[code]/time-slots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGuest } from "@/lib/supabase/guestAuth";
import { mapTimeSlot } from "@/lib/mappers";

type Params = { params: Promise<{ code: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const auth = await requireGuest(request, code);
  if ("error" in auth && auth.error) return auth.error;
  const { guestId, groupId } = auth as { guestId: string; groupId: string };

  const admin = createAdminClient();

  // status 체크
  const { data: g } = await admin.from("groups").select("status").eq("id", groupId).maybeSingle();
  if (g?.status !== "voting") {
    return NextResponse.json({ error: "모임이 마감되었어요" }, { status: 409 });
  }

  const body: { date: string; slots: { startTime: string; endTime: string }[] } =
    await request.json();

  const { data: session } = await admin
    .from("vote_sessions")
    .select("id")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "No vote session" }, { status: 404 });
  }
  const sessionId = session.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // 기존 본인 슬롯 삭제
  const { error: delErr } = await sb
    .from("time_slots")
    .delete()
    .eq("session_id", sessionId)
    .eq("guest_id", guestId)
    .eq("date", body.date);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (body.slots.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const rows = body.slots.map((s) => ({
    session_id: sessionId,
    user_id: null,
    guest_id: guestId,
    date: body.date,
    start_time: s.startTime,
    end_time: s.endTime,
  }));

  const { data, error: insErr } = await sb.from("time_slots").insert(rows).select();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ data: ((data ?? []) as any[]).map(mapTimeSlot) });
}
```

- [ ] **Step 3: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/invite/[code]/votes/route.ts src/app/api/invite/[code]/time-slots/route.ts
git commit -m "feat(api): 게스트용 votes/time-slots 라우트 (POST/PATCH/PUT)"
```

---

## Task 10: GuestNicknameModal

**Files:**
- Create: `src/components/vote/GuestNicknameModal.tsx`

- [ ] **Step 1: 모달 작성**

```tsx
"use client";

import { useState } from "react";

type Props = {
  groupName: string;
  onSubmit: (nickname: string) => void;
};

export function GuestNicknameModal({ groupName, onSubmit }: Props) {
  const [nickname, setNickname] = useState("");
  const trimmed = nickname.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 12;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 dark:bg-gray-900 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {groupName}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          모임에 참여하려면 닉네임을 입력해주세요.
        </p>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="예: 민지"
          maxLength={12}
          className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          autoFocus
        />
        <button
          type="button"
          disabled={!valid}
          onClick={() => valid && onSubmit(trimmed)}
          className="mt-4 w-full min-h-11 rounded-xl bg-violet-600 py-3 font-semibold text-white transition-colors hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-700"
          aria-label="닉네임으로 참여"
        >
          투표 참여하기
        </button>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          이 폰에서만 본인 투표를 수정할 수 있어요.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/vote/GuestNicknameModal.tsx
git commit -m "feat(vote): GuestNicknameModal — 게스트 닉네임 입력 모달"
```

---

## Task 11: 게스트 화면 — /g/[code]/page.tsx + GuestVoteClient

**Files:**
- Create: `src/app/g/[code]/page.tsx`
- Create: `src/app/g/[code]/GuestVoteClient.tsx`

- [ ] **Step 1: page.tsx (서버)**

코드 검증 → 회원이면 멤버십 체크 후 `/group/<id>` 또는 게스트로 진행 → confirmed/completed면 read-only.

```tsx
// src/app/g/[code]/page.tsx
import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GuestVoteClient } from "./GuestVoteClient";
import { ROUTES } from "@/lib/routes";

type Props = { params: Promise<{ code: string }> };

export default async function GuestGroupPage({ params }: Props) {
  const { code } = await params;
  const admin = createAdminClient();

  const { data: group } = await admin
    .from("groups")
    .select("id, name, status, confirmed_date, confirmed_start_time, confirmed_end_time")
    .eq("invite_code", code)
    .maybeSingle();

  if (!group) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
          유효하지 않은 링크예요
        </h1>
        <p className="text-sm text-gray-500">
          링크가 만료됐거나 잘못 입력된 것 같아요.
        </p>
      </div>
    );
  }

  // 회원이면서 그 모임 멤버 → 회원 화면으로 redirect.
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: membership } = await admin
      .from("group_members")
      .select("group_id")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership) {
      redirect(`/group/${group.id}`);
    }
  }

  // confirmed/completed → read-only 결과 화면.
  if (group.status !== "voting") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <span className="text-3xl mb-3">🎉</span>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {group.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">일정이 확정되었어요</p>
        {group.confirmed_date && (
          <p className="mt-3 text-base font-semibold text-violet-600 dark:text-violet-400">
            {group.confirmed_date}
            {(group as { confirmed_start_time: string | null }).confirmed_start_time &&
              ` ${(group as { confirmed_start_time: string }).confirmed_start_time}~${(group as { confirmed_end_time: string }).confirmed_end_time}`}
          </p>
        )}
      </div>
    );
  }

  return <GuestVoteClient code={code} groupId={group.id} groupName={group.name} />;
}
```

- [ ] **Step 2: GuestVoteClient.tsx**

GroupDetailClient를 참고하되 **read-only 변형**: 댓글/확정/장소/기록 미노출. 시간 매트릭스/날짜 토글만.

```tsx
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { GuestNicknameModal } from "@/components/vote/GuestNicknameModal";
import { DateToggleRow } from "@/components/vote/DateToggleRow";
import { BestTimeBanner } from "@/components/vote/BestTimeBanner";
import { TimeGrid } from "@/components/vote/TimeGrid";
import { useTimeSlotSelection } from "@/hooks/useTimeSlotSelection";
import { useGuestRealtime } from "@/hooks/useGuestRealtime";
import { getRankedTimeSlots } from "@/lib/vote";
import {
  getGuestToken,
  setGuestToken,
  setGuestNickname,
  generateBrowserToken,
} from "@/lib/guest";
import { guestFetch } from "@/lib/api/guest";
import type { Vote, VoteChoice, VoteSession, TimeSlot, User, Guest } from "@/types";

type State = {
  group: { id: string; name: string; members: User[]; guests: Guest[] };
  voteSession: VoteSession | null;
  votes: Vote[];
  timeSlots: TimeSlot[];
  currentGuestId: string;
};

function cycleDateChoice(current: VoteChoice | null): VoteChoice | null {
  if (current === null) return "available";
  if (current === "available") return "unavailable";
  return null;
}

type Props = { code: string; groupId: string; groupName: string };

export function GuestVoteClient({ code, groupId, groupName }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [needsNickname, setNeedsNickname] = useState(false);

  // 1. mount: localStorage 토큰 확인.
  useEffect(() => {
    const existing = getGuestToken(groupId);
    if (existing) {
      setToken(existing);
    } else {
      setNeedsNickname(true);
    }
  }, [groupId]);

  // 2. 토큰 있으면 state fetch.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await guestFetch(`/api/invite/${code}/state`, {
        method: "GET",
        token,
      });
      if (res.status === 401) {
        // 토큰이 서버에 없음 → 다시 닉네임 입력
        setToken(null);
        setNeedsNickname(true);
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      if (!cancelled) setState(json.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, code]);

  // 3. 닉네임 모달 제출 → 게스트 등록.
  const handleNicknameSubmit = useCallback(
    async (nickname: string) => {
      const browserToken = generateBrowserToken();
      const res = await fetch(`/api/invite/${code}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, browserToken }),
      });
      if (!res.ok) return;
      setGuestToken(groupId, browserToken);
      setGuestNickname(groupId, nickname);
      setToken(browserToken);
      setNeedsNickname(false);
    },
    [code, groupId]
  );

  if (needsNickname) {
    return <GuestNicknameModal groupName={groupName} onSubmit={handleNicknameSubmit} />;
  }
  if (!state || !token) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-sm text-gray-500">
        로딩 중…
      </div>
    );
  }

  return (
    <GuestVoteInner
      code={code}
      token={token}
      initialState={state}
    />
  );
}

function GuestVoteInner({
  code,
  token,
  initialState,
}: {
  code: string;
  token: string;
  initialState: State;
}) {
  const { group, voteSession, currentGuestId } = initialState;
  const sessionId = voteSession?.id ?? "";

  const { votes, timeSlots: allTimeSlots } = useGuestRealtime(
    sessionId,
    initialState.votes,
    initialState.timeSlots
  );

  const [dateChoices, setDateChoices] = useState<Record<string, VoteChoice | null>>(() => {
    const map: Record<string, VoteChoice | null> = {};
    if (voteSession) {
      voteSession.candidateDates.forEach((d) => {
        const v = initialState.votes.find(
          (vote) => vote.guestId === currentGuestId && vote.date === d
        );
        map[d] = v?.choice ?? null;
      });
    }
    return map;
  });

  const myInitialSlots = useMemo(
    () => initialState.timeSlots.filter((s) => s.guestId === currentGuestId),
    [initialState.timeSlots, currentGuestId]
  );
  const {
    pendingStart,
    handleCellClick,
    commitSweptSlots,
    isSlotSelected,
    getSelectedRanges,
    rangesByDate,
    pendingPersist,
  } = useTimeSlotSelection(myInitialSlots);

  const handleDateToggle = useCallback(
    async (date: string) => {
      const current = dateChoices[date] ?? null;
      const next = cycleDateChoice(current);
      setDateChoices((prev) => ({ ...prev, [date]: next }));
      if (!voteSession || next === null) return;
      const existing = votes.find(
        (v) => v.guestId === currentGuestId && v.date === date
      );
      const method = existing ? "PATCH" : "POST";
      await guestFetch(`/api/invite/${code}/votes`, {
        method,
        token,
        body: JSON.stringify({ date, choice: next }),
      });
    },
    [dateChoices, voteSession, votes, currentGuestId, code, token]
  );

  const lastPersistedNonce = useRef(0);
  useEffect(() => {
    if (!sessionId) return;
    if (pendingPersist.nonce === 0) return;
    if (pendingPersist.nonce === lastPersistedNonce.current) return;
    lastPersistedNonce.current = pendingPersist.nonce;
    for (const date of pendingPersist.dates) {
      const ranges = getSelectedRanges(date);
      guestFetch(`/api/invite/${code}/time-slots`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          date,
          slots: ranges.map((r) => ({ startTime: r.startTime, endTime: r.endTime })),
        }),
      });
    }
  }, [pendingPersist, sessionId, getSelectedRanges, code, token]);

  const activeDates = voteSession
    ? voteSession.candidateDates.filter((d) => dateChoices[d] === "available")
    : [];

  const othersTimeSlots = useMemo<TimeSlot[]>(
    () => allTimeSlots.filter((s) => s.guestId !== currentGuestId),
    [allTimeSlots, currentGuestId]
  );

  const effectiveTimeSlots = useMemo<TimeSlot[]>(() => {
    if (!voteSession) return othersTimeSlots;
    const mine: TimeSlot[] = [];
    for (const date of voteSession.candidateDates) {
      const ranges = rangesByDate[date] ?? [];
      ranges.forEach((r, idx) => {
        mine.push({
          id: `local-${date}-${idx}`,
          sessionId: voteSession.id,
          userId: null,
          guestId: currentGuestId,
          date,
          startTime: r.startTime,
          endTime: r.endTime,
        });
      });
    }
    return [...othersTimeSlots, ...mine];
  }, [othersTimeSlots, rangesByDate, voteSession, currentGuestId]);

  const totalParticipants = group.members.length + group.guests.length;
  const rankedSlots = getRankedTimeSlots(effectiveTimeSlots, activeDates, 2);
  // "다른 사람 수" — 본인(게스트) 제외 = 회원 + 다른 게스트.
  const othersTotal = Math.max(0, totalParticipants - 1);

  return (
    <div className="bg-gray-50 min-h-dvh pb-[40px] dark:bg-gray-950">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <Link
          href={ROUTES.HOME}
          aria-label="홈으로"
          className="min-h-11 min-w-11 flex items-center justify-center -ml-2"
        >
          <ChevronLeft size={24} className="text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
            {group.name}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {totalParticipants}명 참여 · 게스트로 투표 중
          </p>
        </div>
      </div>

      {voteSession ? (
        <>
          <div className="px-5 mt-4">
            <DateToggleRow
              dates={voteSession.candidateDates}
              choices={dateChoices}
              onToggle={handleDateToggle}
            />
          </div>

          <BestTimeBanner slots={rankedSlots} totalMembers={totalParticipants} />

          <TimeGrid
            dates={voteSession.candidateDates}
            dateChoices={dateChoices}
            isSlotSelected={isSlotSelected}
            pendingStart={pendingStart}
            othersTimeSlots={othersTimeSlots}
            othersTotal={othersTotal}
            onCellClick={(d, t) => handleCellClick(d, t)}
            onDragCommit={commitSweptSlots}
          />
        </>
      ) : (
        <p className="px-5 mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          투표 세션이 없어요.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: typecheck**

```bash
pnpm typecheck
```

깨진 곳: `useTimeSlotSelection` initial slots에 guestId가 추가됐을 수 있다. 또는 `getRankedTimeSlots` 시그니처. 확인 후 수정.

- [ ] **Step 4: Commit**

```bash
git add src/app/g/[code]/page.tsx src/app/g/[code]/GuestVoteClient.tsx
git commit -m "feat(guest): /g/[code] 게스트 진입 + GuestVoteClient (read-only 변형)"
```

---

## Task 12: useGuestRealtime 훅

**Files:**
- Create: `src/hooks/useGuestRealtime.ts`

- [ ] **Step 1: 훅 작성**

`useVoteRealtime`과 동일하지만 **anon client**(`createBrowserClient`)로 구독. anon이 votes/time_slots SELECT RLS를 통과해야 하는데, 기존 RLS는 멤버 제한이라 anon은 실시간 데이터를 직접 받지 못한다.

→ 대안: 게스트 화면도 `useVoteRealtime` 그대로 재사용. 클라이언트는 `createBrowserClient()`를 호출하지만 익명이라 supabase가 주는 실시간 메시지를 받기는 한다(채널 자체는 anon에게 열려있음, RLS는 SELECT 시점에만 적용).

실험적으로 동일 훅을 재사용. 단 anon이 해당 row를 select 못해 payload.new가 안 도착할 수 있다 — 그 경우 fallback으로 polling.

**v1 결정:** 단순화. 게스트 화면은 mount 시 한 번 fetch + 30초마다 polling. Realtime은 v1.5.

```ts
// src/hooks/useGuestRealtime.ts
"use client";

import { useEffect, useState } from "react";
import { guestFetch } from "@/lib/api/guest";
import type { Vote, TimeSlot } from "@/types";

export function useGuestRealtime(
  sessionId: string,
  initialVotes: Vote[],
  initialTimeSlots: TimeSlot[]
): { votes: Vote[]; timeSlots: TimeSlot[] } {
  const [votes, setVotes] = useState(initialVotes);
  const [timeSlots, setTimeSlots] = useState(initialTimeSlots);

  // 본인 액션은 즉시 반영을 위해 skip — 단순 polling은 다른 사람 변경 추적 용도.
  useEffect(() => {
    if (!sessionId) return;
    // 30초 polling — 데모 demo 수준에는 충분.
    // path에서 code를 알아내야 하는데 sessionId만으로는 부족 → window.location 사용.
    const code = (() => {
      const m = window.location.pathname.match(/\/g\/([^/]+)/);
      return m?.[1] ?? null;
    })();
    if (!code) return;
    const token = (() => {
      // tokenless에서는 polling 못 하지만 GuestVoteClient에서 mount 시점에 token이 보장됨.
      // 안전장치로 localStorage에서 직접 추출.
      const keys = Object.keys(window.localStorage);
      for (const k of keys) {
        if (k.startsWith("guest-token:")) {
          return window.localStorage.getItem(k);
        }
      }
      return null;
    })();
    if (!token) return;

    const interval = setInterval(async () => {
      const res = await guestFetch(`/api/invite/${code}/state`, {
        method: "GET",
        token,
      });
      if (!res.ok) return;
      const json = await res.json();
      setVotes(json.data.votes);
      setTimeSlots(json.data.timeSlots);
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  return { votes, timeSlots };
}
```

(5초 polling이 데모 시연에서 "거의 실시간" 느낌이 적당.)

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useGuestRealtime.ts
git commit -m "feat(guest): useGuestRealtime — 5초 polling으로 다른 참여자 변경 반영"
```

---

## Task 13: 호스트 화면 — invite link 복사 + 게스트 합산

**Files:**
- Modify: `src/app/group/[id]/page.tsx`
- Modify: `src/app/group/[id]/GroupDetailClient.tsx`

- [ ] **Step 1: page.tsx에서 group_guests fetch + Group에 guests 포함**

기존 page.tsx에 group_guests fetch 추가. members + guests를 Group에 합쳐서 GroupDetailClient에 전달.

```ts
// src/app/group/[id]/page.tsx — Stage 1, Stage 2 추가 변경

// Stage 1 끝난 다음 admin client 부분:
const adminClient = createAdminClient();
const [
  { data: allMemberships },
  { data: guestRows },
] = await Promise.all([
  adminClient.from("group_members").select("user_id").eq("group_id", id),
  adminClient.from("group_guests").select("*").eq("group_id", id),
]);

const memberIds = (allMemberships ?? []).map((m) => m.user_id);

// ... (Stage 2 그대로) ...

const members: User[] = (usersData ?? []).map(mapUser);
const guests = (guestRows ?? []).map(mapGuest);
const group: Group = { ...mapGroup(groupRow), members, guests };
```

import에 `mapGuest` 추가.

`GroupDetailClient`에는 `currentUserId` prop은 그대로 유지.

- [ ] **Step 2: GroupDetailClient — handleCopyLink 변경**

```ts
// src/app/group/[id]/GroupDetailClient.tsx

const handleCopyLink = useCallback(async () => {
  if (!group.inviteCode) {
    // 백필이 안 된 모임 — fallback으로 현재 URL.
    await navigator.clipboard.writeText(window.location.href);
  } else {
    const url = `${window.location.origin}/g/${group.inviteCode}`;
    await navigator.clipboard.writeText(url);
  }
  setLinkCopied(true);
  setTimeout(() => setLinkCopied(false), 2000);
}, [group.inviteCode]);
```

- [ ] **Step 3: 매트릭스/카운트에 게스트 합산**

`GroupDetailClient` 내:

```ts
// totalParticipants = members + guests
const totalParticipants = group.members.length + group.guests.length;

// othersTotal — 본인 제외
const othersTotal = Math.max(0, totalParticipants - 1);

// 헤더의 "{group.members.length}명 참여" → "{totalParticipants}명 참여"

// BestTimeBanner totalMembers → totalParticipants
```

`isAllVoted`는 회원 전체 + 게스트 전체로 의미가 헷갈리므로 v1에서는 게스트는 카운트에서 제외 — "회원 전체가 투표하면 확정 가능" 의미 유지. (게스트는 임의로 들어와서 투표 안 할 수도 있음.)

```ts
const memberIds = group.members.map((m) => m.id);
const allVoted = voteSession ? isAllVoted(voteSession, votes, memberIds) : false;
// 그대로 OK — memberIds(회원만)로 isAllVoted 호출.
```

- [ ] **Step 4: 댓글 게스트 표시**

`CommentSection.tsx`은 `votes`에서 `userId`로 멤버 lookup 중. 게스트는 댓글 없음(서버 API에서 comment 항상 null). 그래서 변경 최소: `vote.userId === null`이면 skip.

```tsx
// src/components/vote/CommentSection.tsx — render에서
votes.filter((v) => v.userId !== null && v.comment).map(...)
```

- [ ] **Step 5: 게스트 뱃지 — 멤버 표시 컴포넌트**

GroupDetailClient에서 직접 멤버 아바타를 렌더하는 곳이 있는지 확인. (`group.members.length`만 쓰고 아바타는 별도 컴포넌트면 그쪽 수정.)

본 plan 단계에서는 헤더 카운트만 합산 처리. 아바타 스택에 게스트 표시는 v1.5(시연용은 카운트만 보임).

- [ ] **Step 6: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/app/group/[id]/page.tsx src/app/group/[id]/GroupDetailClient.tsx src/components/vote/CommentSection.tsx
git commit -m "feat(host): 모임 상세 — invite link 복사 + 게스트 카운트 합산"
```

---

## Task 14: vote 라이브러리 — guest 응답 인식

**Files:**
- Modify: `src/lib/vote.ts`

- [ ] **Step 1: 현재 코드 확인**

```bash
grep -n "userId" src/lib/vote.ts
```

`getBestDate`, `isAllVoted`, `getRankedTimeSlots`가 어떻게 votes/timeSlots를 다루는지 확인. 게스트 응답도 자연스럽게 카운트되도록 — `userId`만 참조하는 곳이 있으면 `userId ?? guestId`로 lookup키를 통일.

- [ ] **Step 2: 필요 수정**

`getRankedTimeSlots` 같이 "사람 수" 세는 함수가 `userId`로 distinct하면 게스트는 묶인다(모두 null). → distinct 키를 `userId ?? guestId`로 변경.

```ts
// 예시 변경 (실 파일에 맞춰 적용)
const voterKey = (s: TimeSlot) => s.userId ?? s.guestId ?? "unknown";
```

- [ ] **Step 3: typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/vote.ts
git commit -m "feat(vote): 게스트 응답을 distinct voter로 인식 (userId ?? guestId)"
```

---

## Task 15: useTimeSlotSelection — guest_id 호환성

**Files:**
- Modify: `src/hooks/useTimeSlotSelection.ts` (필요시)

- [ ] **Step 1: 코드 확인**

`useTimeSlotSelection`이 initial slots에서 `userId`만 필터링하는지 확인. GuestVoteClient에서 게스트 본인 슬롯을 `s.guestId === currentGuestId`로 필터해 넘기므로 hook 자체에는 변경 불필요할 가능성이 높음.

- [ ] **Step 2: 필요시 수정 + commit**

수정 없으면 skip.

---

## Task 16: 최종 typecheck + lint + 수동 QA 체크

- [ ] **Step 1: typecheck**

```bash
pnpm typecheck
```

기대: 0 error.

- [ ] **Step 2: lint**

```bash
pnpm lint
```

기대: 0 error.

- [ ] **Step 3: 사용자 핸드오프 안내**

다음 항목을 사용자에게 전달:

- 마이그레이션 008을 Supabase Dashboard에서 적용했는지 확인 (Task 1 Step 2)
- `pnpm db:types` 실행했는지 확인 (Task 1 Step 3)
- 백필 스크립트 실행 여부 (Task 2 Step 3)
- 수동 QA 체크리스트:
  - 모임 생성 → 우상단 링크 복사 → 시크릿 모드/다른 폰에서 열어보기
  - 닉네임 입력 → 투표 매트릭스 진입
  - 시간 선택 → 호스트 화면(다른 탭)에서 5초 내 반영 확인
  - 같은 폰에서 새로고침 시 닉네임 모달 안 뜨고 본인 투표 보이는지
  - 모임 confirmed 후 게스트 링크 진입 → read-only 결과 표시
  - 잘못된 코드(예: `/g/INVALID0`) → "유효하지 않은 링크" 표시

---

## Spec Coverage Check

스펙 § | 구현 task |
|---|---|
| § 2 결정 — 게스트 = 시간 투표만 | Task 9, 11 (댓글 X, 확정 버튼 X, 장소 X) |
| § 2 결정 — 닉네임+localStorage 토큰 | Task 5, 10, 11 |
| § 2 결정 — 회원과 동일 취급 + 뱃지 | Task 13 (카운트 합산), 뱃지는 v1.5 |
| § 2 결정 — `/g/<8자리코드>` | Task 1 (스키마), 2 (생성 유틸), 3 (자동 발급), 11 (라우트) |
| § 4 데이터 모델 | Task 1 |
| § 5 API | Task 6, 7, 8, 9 |
| § 6 UI 변경 | Task 4 (라우트), 10 (모달), 11 (게스트 화면), 13 (호스트 화면) |
| § 7 Realtime | Task 12 (polling fallback) |
| § 8 보안/엣지 — 잘못된 코드 | Task 11 Step 1 |
| § 8 — confirmed 후 read-only | Task 11 Step 1 |
| § 8 — 회원·멤버는 redirect | Task 11 Step 1 |
| § 9 v1 범위 외 | 의도적 스킵 (호스트 toggle, 회원 자동 가입, 게스트 제거, 만료) |
