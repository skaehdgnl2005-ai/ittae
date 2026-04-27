# 친구 추가 메커니즘 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 닉네임 부분 검색 + 사용자별 짧은 초대 링크(`/i/[code]`) 두 축으로 친구를 추가하고, 받은 요청을 친구 탭 상단 섹션에서 수락/거절할 수 있는 메커니즘을 구현한다.

**Architecture:** Server action이 게이트키퍼. 검색·초대조회는 admin client로 다른 사용자 행을 읽고 `PublicUser`로 정제해 반환. 신청·수락·거절은 일반 `createServerClient()`로 친구쉽 RLS 정책에 의존(거절용 delete 정책만 신규 추가). UI는 친구 탭 상단의 받은 요청 섹션 + 검색바 옆 `+` 버튼이 여는 바텀시트(검색 + 내 초대 링크). `/i/[code]`가 초대 도착 페이지.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind · shadcn/ui · Supabase(Postgres + RLS + admin SDK) · Kakao OAuth · Vitest.

**Spec:** [`docs/superpowers/specs/2026-04-27-friend-add-design.md`](../specs/2026-04-27-friend-add-design.md)

---

## File Structure

**신규**
- `supabase/migrations/004_friend_add.sql`
- `src/lib/invite-code.ts` + `src/lib/__tests__/invite-code.test.ts`
- `src/lib/share.ts`
- `src/app/friends/actions.ts`
- `src/components/friends/PendingRequestsSection.tsx`
- `src/components/friends/AddFriendSheet.tsx`
- `src/components/friends/UserSearchResultCard.tsx`
- `src/app/i/[code]/page.tsx`
- `src/app/i/[code]/InviteAcceptCard.tsx`

**수정**
- `src/types/index.ts` — `PublicUser`, `RelationshipStatus`, `UserSearchResult`, `PendingFriendRequest`
- `src/lib/mappers.ts` — `mapPublicUser`
- `src/lib/routes.ts` — `INVITE`
- `src/app/profile/setup/actions.ts` — invite_code 생성/재시도
- `src/app/(main)/friends/page.tsx` — pending requests fetch
- `src/components/friends/FriendsView.tsx` — 받은 요청 섹션 + `+` 버튼 + Sheet
- `src/types/supabase.ts` — `pnpm db:types`로 재생성

---

## Task 1: 마이그레이션 (invite_code + delete RLS)

**Files:**
- Create: `supabase/migrations/004_friend_add.sql`
- Modify: `src/types/supabase.ts` (재생성)

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- ============================================================
-- 004_friend_add.sql
-- 친구 추가: invite_code 컬럼 + 백필 + friendships 거절(delete) RLS
-- ============================================================

-- 1. users.invite_code 컬럼 + partial unique index
alter table users add column invite_code text;
create unique index users_invite_code_unique_idx
  on users(invite_code) where invite_code is not null;

-- 2. 6자 invite_code 생성 함수 (혼동 글자 제외)
create or replace function generate_invite_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  end loop;
  return result;
end;
$$;

-- 3. 기존 사용자 백필: 충돌 시 재시도
do $$
declare
  u record;
  attempt int;
  candidate text;
begin
  for u in select id from users where invite_code is null loop
    attempt := 0;
    loop
      candidate := generate_invite_code();
      begin
        update users set invite_code = candidate where id = u.id;
        exit;
      exception when unique_violation then
        attempt := attempt + 1;
        if attempt >= 5 then
          raise exception 'invite_code 생성 5회 실패: user %', u.id;
        end if;
      end;
    end loop;
  end loop;
end $$;

-- 4. 거절을 위한 friendships delete 정책
create policy "friendships_delete_receiver" on friendships
  for delete using (auth.uid() = receiver_id);
```

- [ ] **Step 2: 마이그레이션 적용 (Supabase 로컬 또는 원격)**

Run: `pnpm db:types` 전에 마이그레이션을 적용한다. 로컬 Supabase면 `supabase db reset` 또는 마이그 push, 원격이면 Supabase Studio SQL editor에 붙여넣기 또는 `supabase db push`.

Expected: 적용 후 `select id, invite_code from users limit 5;` → 모든 행에 6자 코드가 채워져 있음.

- [ ] **Step 3: 타입 재생성**

Run: `pnpm db:types`
Expected: `src/types/supabase.ts`에 `users.invite_code: string | null` 추가됨.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/004_friend_add.sql src/types/supabase.ts
git commit -m "feat(db): users.invite_code + friendships delete RLS"
```

---

## Task 2: invite-code 헬퍼 (TDD)

**Files:**
- Create: `src/lib/invite-code.ts`
- Test: `src/lib/__tests__/invite-code.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/__tests__/invite-code.test.ts
import { describe, it, expect } from "vitest";
import { generateInviteCode, INVITE_CODE_ALPHABET } from "../invite-code";

describe("generateInviteCode", () => {
  it("6자 길이를 반환한다", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("허용 알파벳 외 글자가 들어 있지 않다", () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateInviteCode();
      for (const ch of code) {
        expect(INVITE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("혼동 글자(0/O/1/I/L)를 포함하지 않는다", () => {
    const banned = ["0", "O", "1", "I", "L"];
    for (const ch of banned) {
      expect(INVITE_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("매번 동일한 값을 반환하지 않는다 (충돌 가능성 무시 가능 수준)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateInviteCode());
    expect(set.size).toBeGreaterThan(90); // 사실상 100
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test src/lib/__tests__/invite-code.test.ts`
Expected: FAIL — `Cannot find module '../invite-code'`.

- [ ] **Step 3: 최소 구현**

```ts
// src/lib/invite-code.ts
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 6;

export function generateInviteCode(): string {
  let result = "";
  for (let i = 0; i < LENGTH; i++) {
    const idx = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
    result += INVITE_CODE_ALPHABET[idx];
  }
  return result;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/__tests__/invite-code.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/invite-code.ts src/lib/__tests__/invite-code.test.ts
git commit -m "feat(lib): invite-code 헬퍼 (32자 알파벳, 6자)"
```

---

## Task 3: 타입·매퍼·라우트 추가

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/mappers.ts`
- Modify: `src/lib/routes.ts`

- [ ] **Step 1: 타입 추가**

`src/types/index.ts` 끝에 추가:

```ts
export type PublicUser = Pick<User, "id" | "nickname" | "profileImageUrl" | "statusMessage">;

export type RelationshipStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "accepted";

export type UserSearchResult = PublicUser & { relationship: RelationshipStatus };

export type PendingFriendRequest = {
  requesterId: string;
  requester: PublicUser;
  createdAt: string;
};
```

- [ ] **Step 2: 매퍼 추가**

`src/lib/mappers.ts` 끝에 추가:

```ts
import type { PublicUser } from "@/types";

type PublicUserRow = {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  status_message: string | null;
};

export function mapPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    nickname: row.nickname,
    profileImageUrl: row.profile_image_url,
    statusMessage: row.status_message,
  };
}
```

> 상단 import 줄에 `PublicUser`도 같이 가져오거나, 위처럼 별도 import 추가 모두 OK. 시그니처를 좁힌 row 타입으로 받아서 `select("id, nickname, profile_image_url, status_message")` 결과를 캐스팅 없이 그대로 넘길 수 있음.

- [ ] **Step 3: 라우트 추가**

`src/lib/routes.ts` 수정:

```ts
export const ROUTES = {
  HOME: "/home",
  LOGIN: "/login",
  AUTH_CALLBACK: "/auth/callback",
  AUTH_CALLBACK_KAKAO: "/auth/callback/kakao",
  PROFILE_SETUP: "/profile/setup",
  INVITE: (code: string) => `/i/${code}`,
} as const;
```

- [ ] **Step 4: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/types/index.ts src/lib/mappers.ts src/lib/routes.ts
git commit -m "feat(types): PublicUser/relationship/PendingFriendRequest + INVITE 라우트"
```

---

## Task 4: setupProfile에 invite_code 생성 추가

**Files:**
- Modify: `src/app/profile/setup/actions.ts`

- [ ] **Step 1: setupProfile 수정**

```ts
// src/app/profile/setup/actions.ts
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/invite-code";

type SetupProfileInput = {
  userId: string;
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
  statusMessage: string | null;
};

type SetupProfileResult = { success: boolean; error?: string };

const MAX_INVITE_CODE_RETRIES = 5;

export async function setupProfile({
  userId,
  email,
  nickname,
  profileImageUrl,
  statusMessage,
}: SetupProfileInput): Promise<SetupProfileResult> {
  console.log("[setupProfile] start", { userId, hasEmail: !!email, nickname });

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "로그인이 만료되었습니다. 다시 로그인해 주세요." };
    }

    // 기존 invite_code 보존: 이미 가지고 있다면 재생성하지 않는다.
    const { data: existing } = await supabase
      .from("users")
      .select("invite_code")
      .eq("id", userId)
      .maybeSingle();

    let inviteCode = existing?.invite_code ?? null;

    for (let attempt = 0; inviteCode == null && attempt < MAX_INVITE_CODE_RETRIES; attempt++) {
      const candidate = generateInviteCode();
      const payload = {
        id: userId,
        email: email && email.trim().length > 0 ? email : null,
        nickname,
        profile_image_url: profileImageUrl,
        status_message: statusMessage,
        invite_code: candidate,
      };
      const { error } = await supabase.from("users").upsert(payload);
      if (!error) {
        inviteCode = candidate;
        console.log("[setupProfile] upsert ok, invite_code", candidate);
        return { success: true };
      }
      // 23505 = unique_violation. invite_code 충돌이면 재시도, 아니면 즉시 실패.
      if (error.code !== "23505") {
        console.error("[setupProfile] upsert error", error);
        return { success: false, error: `${error.code ?? ""} ${error.message}`.trim() };
      }
      console.warn("[setupProfile] invite_code 충돌, 재시도", attempt + 1);
    }

    if (inviteCode == null) {
      return { success: false, error: "invite_code 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }

    // 이미 invite_code가 있던 사용자(닉네임/상태 메시지 갱신만)
    const payload = {
      id: userId,
      email: email && email.trim().length > 0 ? email : null,
      nickname,
      profile_image_url: profileImageUrl,
      status_message: statusMessage,
    };
    const { error } = await supabase.from("users").upsert(payload);
    if (error) {
      console.error("[setupProfile] upsert error", error);
      return { success: false, error: `${error.code ?? ""} ${error.message}`.trim() };
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[setupProfile] unexpected", msg);
    return { success: false, error: `예외 발생: ${msg}` };
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/app/profile/setup/actions.ts
git commit -m "feat(profile): setupProfile에서 invite_code 생성/재시도"
```

---

## Task 5: server action — searchUsersByNickname

**Files:**
- Create: `src/app/friends/actions.ts`

- [ ] **Step 1: actions.ts 시작 — 공통 타입 + 검색 액션**

```ts
// src/app/friends/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapPublicUser } from "@/lib/mappers";
import type {
  PublicUser,
  UserSearchResult,
  RelationshipStatus,
} from "@/types";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SEARCH_LIMIT = 20;

export async function searchUsersByNickname(
  query: string
): Promise<Result<UserSearchResult[]>> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { ok: true, data: [] };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();

  // ILIKE %query% 매칭, 자기 자신 제외, limit
  // PostgREST: like는 *를 와일드카드로 받음. 또는 .ilike('nickname', `%${q}%`)
  const escaped = trimmed.replace(/[%_]/g, (m) => `\\${m}`);
  const { data: rows, error } = await admin
    .from("users")
    .select("id, nickname, profile_image_url, status_message")
    .ilike("nickname", `%${escaped}%`)
    .neq("id", user.id)
    .limit(SEARCH_LIMIT);

  if (error) {
    console.error("[searchUsersByNickname]", error);
    return { ok: false, error: "검색에 실패했습니다." };
  }

  const candidates = (rows ?? []).map(mapPublicUser);

  if (candidates.length === 0) {
    return { ok: true, data: [] };
  }

  // friendships 한 번 조회로 relationship 주석
  const ids = candidates.map((u) => u.id);
  const { data: rels } = await admin
    .from("friendships")
    .select("requester_id, receiver_id, status")
    .or(
      `and(requester_id.eq.${user.id},receiver_id.in.(${ids.join(",")})),and(receiver_id.eq.${user.id},requester_id.in.(${ids.join(",")}))`
    );

  const relMap = new Map<string, RelationshipStatus>();
  for (const r of rels ?? []) {
    const otherId = r.requester_id === user.id ? r.receiver_id : r.requester_id;
    if (r.status === "accepted") {
      relMap.set(otherId, "accepted");
    } else if (r.status === "pending") {
      relMap.set(
        otherId,
        r.requester_id === user.id ? "pending_sent" : "pending_received"
      );
    }
  }

  const data: UserSearchResult[] = candidates.map((u) => ({
    ...u,
    relationship: relMap.get(u.id) ?? "none",
  }));

  return { ok: true, data };
}
```

> `mapPublicUser`는 Task 3에서 좁힌 row 타입을 받으므로 select 결과를 그대로 매핑 가능.

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/app/friends/actions.ts
git commit -m "feat(friends): searchUsersByNickname server action"
```

---

## Task 6: server action — sendFriendRequest

**Files:**
- Modify: `src/app/friends/actions.ts`

- [ ] **Step 1: 액션 추가**

`src/app/friends/actions.ts` 하단에 추가:

```ts
export async function sendFriendRequest(
  targetUserId: string
): Promise<Result<void>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (user.id === targetUserId) {
    return { ok: false, error: "자기 자신에게는 신청할 수 없습니다." };
  }

  // 양방향 기존 행 조회 (RLS상 본인이 양 끝에 있는 행은 보임)
  const { data: existing, error: selError } = await supabase
    .from("friendships")
    .select("requester_id, receiver_id, status")
    .or(
      `and(requester_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},receiver_id.eq.${user.id})`
    );

  if (selError) {
    console.error("[sendFriendRequest] select", selError);
    return { ok: false, error: "요청 처리에 실패했습니다." };
  }

  if (existing && existing.length > 0) {
    const row = existing[0];
    const sameDirection = row.requester_id === user.id;
    if (row.status === "accepted") return { ok: false, error: "이미 친구입니다." };
    if (sameDirection) return { ok: false, error: "이미 신청을 보냈어요." };
    return { ok: false, error: "받은 요청에서 수락하세요." };
  }

  const { error: insError } = await supabase.from("friendships").insert({
    requester_id: user.id,
    receiver_id: targetUserId,
    status: "pending",
  });
  if (insError) {
    console.error("[sendFriendRequest] insert", insError);
    return { ok: false, error: "요청 처리에 실패했습니다." };
  }

  revalidatePath("/friends");
  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/app/friends/actions.ts
git commit -m "feat(friends): sendFriendRequest server action"
```

---

## Task 7: server action — accept / reject

**Files:**
- Modify: `src/app/friends/actions.ts`

- [ ] **Step 1: 두 액션 추가**

```ts
export async function acceptFriendRequest(
  requesterId: string
): Promise<Result<void>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("requester_id", requesterId)
    .eq("receiver_id", user.id)
    .eq("status", "pending");

  if (error) {
    console.error("[acceptFriendRequest]", error);
    return { ok: false, error: "수락에 실패했습니다." };
  }

  revalidatePath("/friends");
  return { ok: true, data: undefined };
}

export async function rejectFriendRequest(
  requesterId: string
): Promise<Result<void>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", requesterId)
    .eq("receiver_id", user.id)
    .eq("status", "pending");

  if (error) {
    console.error("[rejectFriendRequest]", error);
    return { ok: false, error: "거절에 실패했습니다." };
  }

  revalidatePath("/friends");
  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/app/friends/actions.ts
git commit -m "feat(friends): accept/reject friend request server actions"
```

---

## Task 8: server action — getInviteUserByCode

**Files:**
- Modify: `src/app/friends/actions.ts`

- [ ] **Step 1: 액션 추가**

```ts
export async function getInviteUserByCode(
  code: string
): Promise<PublicUser | null> {
  const trimmed = code.trim();
  if (trimmed.length !== 6) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, nickname, profile_image_url, status_message")
    .eq("invite_code", trimmed)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    nickname: data.nickname,
    profileImageUrl: data.profile_image_url,
    statusMessage: data.status_message,
  };
}
```

> 일반 server action들과 달리 응답이 `Result<T>`가 아니라 `PublicUser | null` — 서버 컴포넌트에서 직접 호출되어 단순 fetch 의미라 단순화. (서버 컴포넌트는 try/catch로 충분)

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/app/friends/actions.ts
git commit -m "feat(friends): getInviteUserByCode (admin client lookup)"
```

---

## Task 9: 공유 헬퍼 (Kakao + clipboard 폴백)

**Files:**
- Create: `src/lib/share.ts`

- [ ] **Step 1: 헬퍼 작성**

```ts
// src/lib/share.ts
"use client";

type KakaoShareWindow = Window & {
  Kakao?: {
    isInitialized?: () => boolean;
    Share?: {
      sendDefault?: (args: unknown) => void;
    };
  };
};

export type ShareResult = "kakao" | "clipboard" | "failed";

export async function shareInviteLink(args: {
  url: string;
  hostNickname: string;
}): Promise<ShareResult> {
  const w = typeof window !== "undefined" ? (window as KakaoShareWindow) : null;

  // 1. Kakao SDK 초기화 + Share 사용 가능하면 카톡 공유
  if (w?.Kakao?.isInitialized?.() && w.Kakao.Share?.sendDefault) {
    try {
      w.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: `${args.hostNickname}님이 된다에 초대했어요`,
          description: "친구 추가하고 같이 모임을 잡아보세요",
          imageUrl: `${location.origin}/og-invite.png`,
          link: { mobileWebUrl: args.url, webUrl: args.url },
        },
        buttons: [
          {
            title: "친구 추가하기",
            link: { mobileWebUrl: args.url, webUrl: args.url },
          },
        ],
      });
      return "kakao";
    } catch (e) {
      console.warn("[share] Kakao 실패, 클립보드 폴백", e);
    }
  }

  // 2. navigator.clipboard 폴백
  try {
    await navigator.clipboard.writeText(args.url);
    return "clipboard";
  } catch (e) {
    console.error("[share] 클립보드 실패", e);
    return "failed";
  }
}
```

> Kakao SDK가 layout.tsx에 init되어 있지 않으면 항상 clipboard로 폴백. MVP 시연은 폴백만으로 충분히 동작. SDK init은 비범위.

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/share.ts
git commit -m "feat(lib): shareInviteLink (Kakao Share + clipboard fallback)"
```

---

## Task 10: UserSearchResultCard 컴포넌트

**Files:**
- Create: `src/components/friends/UserSearchResultCard.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/components/friends/UserSearchResultCard.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { sendFriendRequest } from "@/app/friends/actions";
import type { UserSearchResult } from "@/types";

type Props = {
  user: UserSearchResult;
};

export function UserSearchResultCard({ user }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<UserSearchResult["relationship"]>(
    user.relationship
  );
  const [toast, setToast] = useState<string | null>(null);

  function handleSend() {
    startTransition(async () => {
      const result = await sendFriendRequest(user.id);
      if (result.ok) {
        setStatus("pending_sent");
        setToast("친구 신청을 보냈어요");
      } else {
        setToast(result.error);
      }
      router.refresh();
    });
  }

  function handleReceivedHint() {
    setToast("친구 탭 상단의 받은 요청에서 수락하세요");
  }

  const config = (() => {
    switch (status) {
      case "none":
        return { label: "친구 신청", disabled: false, onClick: handleSend };
      case "pending_sent":
        return { label: "신청 보냄", disabled: true, onClick: () => {} };
      case "pending_received":
        return {
          label: "받은 요청 있음",
          disabled: false,
          onClick: handleReceivedHint,
        };
      case "accepted":
        return { label: "친구", disabled: true, onClick: () => {} };
    }
  })();

  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar nickname={user.nickname} profileImageUrl={user.profileImageUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {user.nickname}
        </p>
        {user.statusMessage && (
          <p className="text-xs text-gray-400 truncate">{user.statusMessage}</p>
        )}
        {toast && <p className="text-xs text-violet-600 mt-0.5">{toast}</p>}
      </div>
      <button
        type="button"
        onClick={config.onClick}
        disabled={config.disabled || isPending}
        className={cn(
          "min-h-11 px-3 rounded-lg text-xs font-medium transition-colors",
          config.disabled
            ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
            : "bg-violet-600 text-white active:bg-violet-700"
        )}
      >
        {config.label}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/components/friends/UserSearchResultCard.tsx
git commit -m "feat(friends): UserSearchResultCard"
```

---

## Task 11: AddFriendSheet 컴포넌트

**Files:**
- Create: `src/components/friends/AddFriendSheet.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/components/friends/AddFriendSheet.tsx
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, Copy, Share2 } from "lucide-react";
import { searchUsersByNickname } from "@/app/friends/actions";
import { shareInviteLink } from "@/lib/share";
import { ROUTES } from "@/lib/routes";
import { UserSearchResultCard } from "@/components/friends/UserSearchResultCard";
import { cn } from "@/lib/utils";
import type { UserSearchResult } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  myInviteCode: string;
  myNickname: string;
};

const DEBOUNCE_MS = 300;

export function AddFriendSheet({ open, onClose, myInviteCode, myNickname }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [shareToast, setShareToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 디바운스 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await searchUsersByNickname(query);
        if (r.ok) setResults(r.data);
        else setResults([]);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  // 시트 닫히면 리셋
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setShareToast(null);
    }
  }, [open]);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${ROUTES.INVITE(myInviteCode)}`
      : ROUTES.INVITE(myInviteCode);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareToast("초대 링크를 복사했어요");
    } catch {
      setShareToast("복사에 실패했어요");
    }
  }

  async function handleShare() {
    const r = await shareInviteLink({ url: inviteUrl, hostNickname: myNickname });
    setShareToast(
      r === "kakao" ? "카카오톡 공유 창을 열었어요"
        : r === "clipboard" ? "초대 링크를 복사했어요"
        : "공유에 실패했어요"
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60">
      <div
        role="dialog"
        aria-label="친구 추가"
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-2xl p-5 pb-8 max-h-[80dvh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">친구 추가</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="min-h-11 min-w-11 -mr-2 text-gray-400"
          >
            ×
          </button>
        </div>

        {/* 내 초대 링크 */}
        <section className="mb-6">
          <p className="text-[12px] font-medium text-gray-500 mb-2">내 초대 링크</p>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2.5">
            <code className="flex-1 text-sm text-gray-800 dark:text-gray-100 truncate">
              {inviteUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="초대 링크 복사"
              className="min-h-11 min-w-11 flex items-center justify-center text-gray-500"
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="카카오톡으로 공유"
              className="min-h-11 min-w-11 flex items-center justify-center text-violet-600"
            >
              <Share2 size={16} />
            </button>
          </div>
          {shareToast && (
            <p className="text-xs text-violet-600 mt-1.5">{shareToast}</p>
          )}
        </section>

        {/* 닉네임 검색 */}
        <section>
          <p className="text-[12px] font-medium text-gray-500 mb-2">닉네임으로 찾기</p>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="닉네임 검색"
              placeholder="닉네임 일부를 입력"
              className={cn(
                "w-full pl-9 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm",
                "outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white transition-all",
                "dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900"
              )}
            />
          </div>

          <div className="mt-3 space-y-1">
            {isPending && query && (
              <p className="text-xs text-gray-400 py-2 text-center">검색 중...</p>
            )}
            {!isPending && query && results.length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center">검색 결과 없음</p>
            )}
            {results.map((u) => (
              <UserSearchResultCard key={u.id} user={u} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

> 200줄 룰 — 이 파일이 가장 큰데 약 180줄. 통과.

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/components/friends/AddFriendSheet.tsx
git commit -m "feat(friends): AddFriendSheet (검색 + 내 초대 링크)"
```

---

## Task 12: PendingRequestsSection 컴포넌트

**Files:**
- Create: `src/components/friends/PendingRequestsSection.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/components/friends/PendingRequestsSection.tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import {
  acceptFriendRequest,
  rejectFriendRequest,
} from "@/app/friends/actions";
import type { PendingFriendRequest } from "@/types";

type Props = {
  requests: PendingFriendRequest[];
};

export function PendingRequestsSection({ requests }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  function handleAccept(requesterId: string) {
    startTransition(async () => {
      await acceptFriendRequest(requesterId);
      router.refresh();
    });
  }

  function handleReject(requesterId: string) {
    startTransition(async () => {
      await rejectFriendRequest(requesterId);
      router.refresh();
    });
  }

  return (
    <section className="px-5 py-3 bg-violet-50/60 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900">
      <p className="text-[12px] font-medium text-violet-700 dark:text-violet-300 mb-2">
        받은 친구 요청 {requests.length}건
      </p>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.requesterId} className="flex items-center gap-3 py-1">
            <Avatar
              nickname={r.requester.nickname}
              profileImageUrl={r.requester.profileImageUrl}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {r.requester.nickname}
              </p>
              {r.requester.statusMessage && (
                <p className="text-xs text-gray-400 truncate">
                  {r.requester.statusMessage}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleAccept(r.requesterId)}
              disabled={isPending}
              className={cn(
                "min-h-11 px-3 rounded-lg text-xs font-medium",
                "bg-violet-600 text-white active:bg-violet-700"
              )}
            >
              수락
            </button>
            <button
              type="button"
              onClick={() => handleReject(r.requesterId)}
              disabled={isPending}
              className={cn(
                "min-h-11 px-3 rounded-lg text-xs font-medium",
                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              )}
            >
              거절
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/components/friends/PendingRequestsSection.tsx
git commit -m "feat(friends): PendingRequestsSection"
```

---

## Task 13: friends/page.tsx — pending requests fetch

**Files:**
- Modify: `src/app/(main)/friends/page.tsx`

- [ ] **Step 1: 페이지 수정 (pending requests + invite_code)**

```tsx
// src/app/(main)/friends/page.tsx
import { createServerClient } from "@/lib/supabase/server";
import { mapUser, mapGroup, mapPublicUser } from "@/lib/mappers";
import { FriendsView } from "@/components/friends/FriendsView";
import type { User, Group, PendingFriendRequest } from "@/types";

export default async function FriendsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let friends: User[] = [];
  let groups: Group[] = [];
  let pendingRequests: PendingFriendRequest[] = [];
  let myInviteCode = "";
  let myNickname = "";

  if (user) {
    // 본인 프로필 (invite_code, nickname)
    const { data: me } = await supabase
      .from("users")
      .select("invite_code, nickname")
      .eq("id", user.id)
      .maybeSingle();
    myInviteCode = me?.invite_code ?? "";
    myNickname = me?.nickname ?? "";

    // 받은 pending 요청
    const { data: receivedPending } = await supabase
      .from("friendships")
      .select("requester_id, created_at")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (receivedPending && receivedPending.length > 0) {
      const requesterIds = receivedPending.map((r) => r.requester_id);
      // RLS상 자기/친구만 보이므로, 친구가 아닌 요청자는 안 보일 수 있음.
      // → server side에서만 admin client로 채우기
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: requesters } = await admin
        .from("users")
        .select("id, nickname, profile_image_url, status_message")
        .in("id", requesterIds);

      const requesterMap = new Map(
        (requesters ?? []).map((u) => [u.id, mapPublicUser(u)])
      );

      pendingRequests = receivedPending
        .map((r) => {
          const pu = requesterMap.get(r.requester_id);
          if (!pu) return null;
          return {
            requesterId: r.requester_id,
            requester: pu,
            createdAt: r.created_at,
          };
        })
        .filter((x): x is PendingFriendRequest => x !== null);
    }

    // 기존 accepted friends
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

    const friendsPromise = friendIds.length > 0
      ? supabase.from("users").select("*").in("id", friendIds)
      : Promise.resolve({ data: [] as never });

    const membershipsPromise = supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    const [{ data: usersData }, { data: myMemberships }] = await Promise.all([
      friendsPromise,
      membershipsPromise,
    ]);

    friends = (usersData ?? []).map(mapUser);

    const groupIds = (myMemberships ?? []).map((m) => m.group_id);

    if (groupIds.length > 0) {
      const { data: groupRows } = await supabase
        .from("groups")
        .select("*")
        .in("id", groupIds)
        .order("created_at", { ascending: false });

      const { data: allMemberships } = await supabase
        .from("group_members")
        .select("group_id, user_id")
        .in("group_id", groupIds);

      const allMemberIds = [...new Set((allMemberships ?? []).map((m) => m.user_id))];
      const { data: allUsers } = await supabase
        .from("users")
        .select("*")
        .in("id", allMemberIds);

      const userMap = Object.fromEntries(
        (allUsers ?? []).map((u) => [u.id, mapUser(u)])
      );

      const membersByGroup = (allMemberships ?? []).reduce<Record<string, User[]>>(
        (acc, m) => {
          if (!acc[m.group_id]) acc[m.group_id] = [];
          const member = userMap[m.user_id];
          if (member) acc[m.group_id].push(member);
          return acc;
        },
        {}
      );

      groups = (groupRows ?? []).map((row) => ({
        ...mapGroup(row),
        members: membersByGroup[row.id] ?? [],
      }));
    }
  }

  return (
    <FriendsView
      friends={friends}
      groups={groups}
      pendingRequests={pendingRequests}
      myInviteCode={myInviteCode}
      myNickname={myNickname}
    />
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 실패 — `FriendsView` props 시그니처가 아직 안 바뀜. Task 14에서 함께 통과.

- [ ] **Step 3: (커밋은 Task 14와 묶어서)**

---

## Task 14: FriendsView — pending 섹션 + + 버튼 + Sheet

**Files:**
- Modify: `src/components/friends/FriendsView.tsx`

- [ ] **Step 1: FriendsView 수정**

```tsx
// src/components/friends/FriendsView.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { FilterChip } from "@/components/friends/FilterChip";
import { GroupCard } from "@/components/friends/GroupCard";
import { FriendList } from "@/components/friends/FriendList";
import { PendingRequestsSection } from "@/components/friends/PendingRequestsSection";
import { AddFriendSheet } from "@/components/friends/AddFriendSheet";
import { cn } from "@/lib/utils";
import type {
  User,
  Group,
  GroupStatus,
  PendingFriendRequest,
} from "@/types";

type Tab = "friends" | "groups";
type FilterValue = "all" | GroupStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all",       label: "전체" },
  { value: "voting",    label: "투표 중" },
  { value: "confirmed", label: "확정" },
  { value: "completed", label: "완료" },
];

type FriendsViewProps = {
  friends: User[];
  groups: Group[];
  pendingRequests: PendingFriendRequest[];
  myInviteCode: string;
  myNickname: string;
};

export function FriendsView({
  friends,
  groups,
  pendingRequests,
  myInviteCode,
  myNickname,
}: FriendsViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("friends");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const filteredGroups = filter === "all"
    ? groups
    : groups.filter((g) => g.status === filter);

  return (
    <div className="bg-gray-50 min-h-dvh dark:bg-gray-950">
      {/* 탭 */}
      <div role="tablist" className="flex bg-white border-b border-gray-200 px-5 dark:bg-gray-900 dark:border-gray-800">
        {(["friends", "groups"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t
                ? "border-violet-600 text-violet-600 dark:text-violet-400"
                : "border-transparent text-gray-400 dark:text-gray-500"
            )}
          >
            {t === "friends" ? "친구" : "모임"}
          </button>
        ))}
      </div>

      {tab === "friends" ? (
        <div>
          <PendingRequestsSection requests={pendingRequests} />

          {/* 친구 추가 진입점 — 검색바 우측 + 버튼 */}
          <div className="px-5 pt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="친구 추가"
              className={cn(
                "min-h-11 min-w-11 flex items-center justify-center",
                "rounded-full bg-violet-600 text-white active:bg-violet-700"
              )}
            >
              <UserPlus size={18} />
            </button>
          </div>

          <FriendList users={friends} />

          <AddFriendSheet
            open={sheetOpen}
            onClose={() => {
              setSheetOpen(false);
              router.refresh();
            }}
            myInviteCode={myInviteCode}
            myNickname={myNickname}
          />
        </div>
      ) : (
        <div>
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
          <div className="px-5 space-y-3 pb-6">
            {filteredGroups.map((g) => (
              <GroupCard key={g.id} group={g} onClick={() => router.push(`/group/${g.id}`)} />
            ))}
            {filteredGroups.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">모임이 없습니다</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 라인 수 확인**

Run: `wc -l src/components/friends/FriendsView.tsx`
Expected: < 200줄 (대략 130줄 부근).

- [ ] **Step 4: 커밋 (Task 13 변경분 함께)**

```bash
git add src/app/(main)/friends/page.tsx src/components/friends/FriendsView.tsx
git commit -m "feat(friends): pending requests 섹션 + 친구 추가 진입점"
```

---

## Task 15: 초대 도착 페이지 — `/i/[code]` 서버 컴포넌트

**Files:**
- Create: `src/app/i/[code]/page.tsx`

- [ ] **Step 1: 서버 컴포넌트 작성**

```tsx
// src/app/i/[code]/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getInviteUserByCode } from "@/app/friends/actions";
import { Avatar } from "@/components/ui/Avatar";
import { ROUTES } from "@/lib/routes";
import { InviteAcceptCard } from "./InviteAcceptCard";

type Props = { params: { code: string } };

export default async function InvitePage({ params }: Props) {
  const code = params.code;

  const target = await getInviteUserByCode(code);

  if (!target) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
          유효하지 않은 초대 링크예요
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          링크가 만료됐거나 잘못 입력된 것 같아요.
        </p>
        <Link
          href={ROUTES.HOME}
          className="text-sm text-violet-600 underline"
        >
          홈으로
        </Link>
      </div>
    );
  }

  // 비로그인 → 로그인 후 같은 경로로 복귀
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = ROUTES.INVITE(code);
    redirect(`${ROUTES.LOGIN}?next=${encodeURIComponent(next)}`);
  }

  // 본인 코드 — 안내만
  if (user.id === target.id) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <Avatar nickname={target.nickname} profileImageUrl={target.profileImageUrl} size="lg" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mt-4 mb-1">
          내 초대 링크예요
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          친구에게 이 링크를 공유해 보세요.
        </p>
        <Link
          href={ROUTES.HOME}
          className="text-sm text-violet-600 underline"
        >
          홈으로
        </Link>
      </div>
    );
  }

  return <InviteAcceptCard target={target} />;
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: `InviteAcceptCard` 미존재로 실패. Task 16에서 통과.

- [ ] **Step 3: (커밋은 Task 16과 묶어서)**

---

## Task 16: 초대 도착 페이지 — InviteAcceptCard

**Files:**
- Create: `src/app/i/[code]/InviteAcceptCard.tsx`

- [ ] **Step 1: 클라이언트 컴포넌트 작성**

```tsx
// src/app/i/[code]/InviteAcceptCard.tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { sendFriendRequest } from "@/app/friends/actions";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/types";

type Props = { target: PublicUser };

export function InviteAcceptCard({ target }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSend() {
    startTransition(async () => {
      const r = await sendFriendRequest(target.id);
      if (r.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
        setErrorMsg(r.error);
      }
    });
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <Avatar nickname={target.nickname} profileImageUrl={target.profileImageUrl} size="lg" />
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mt-4">
        {target.nickname}
      </h1>
      {target.statusMessage && (
        <p className="text-sm text-gray-500 mt-1">{target.statusMessage}</p>
      )}

      <div className="mt-8 w-full max-w-sm">
        {status === "sent" ? (
          <>
            <p className="text-sm text-violet-600 mb-4">친구 신청을 보냈어요</p>
            <button
              type="button"
              onClick={() => router.push(ROUTES.HOME)}
              className="w-full h-12 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700"
            >
              홈으로
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className={cn(
                "w-full h-12 rounded-xl text-sm font-semibold transition-colors",
                isPending
                  ? "bg-violet-600/40 text-white pointer-events-none"
                  : "bg-violet-600 text-white active:bg-violet-700"
              )}
            >
              {isPending ? "보내는 중..." : "친구 신청"}
            </button>
            {status === "error" && errorMsg && (
              <p className="text-xs text-red-500 mt-2">{errorMsg}</p>
            )}
            <Link
              href={ROUTES.HOME}
              className="block text-xs text-gray-400 mt-3"
            >
              홈으로
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `pnpm typecheck`
Expected: 통과.

- [ ] **Step 3: 커밋 (Task 15 + 16 함께)**

```bash
git add src/app/i/
git commit -m "feat(invite): /i/[code] 도착 페이지 + 친구 신청 카드"
```

---

## Task 17: 최종 검증 (typecheck + lint + 두 플로우 시연)

**Files:** 없음 (검증 단계).

- [ ] **Step 1: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 둘 다 통과.

- [ ] **Step 2: 단위 테스트**

Run: `pnpm test`
Expected: invite-code 테스트 + 기존 Avatar 테스트 통과.

- [ ] **Step 3: 개발 서버 기동**

Run: `pnpm dev`
Expected: `http://localhost:3000`에서 접근 가능.

- [ ] **Step 4: 시연 플로우 A — 초대 링크**

수동 검증:
1. Chrome 일반창에서 카카오 로그인 → 프로필 셋업 → 친구 탭 진입.
2. 친구 탭의 `+` 버튼 → 시트 열림 → "내 초대 링크" 영역의 URL 복사 버튼 클릭 → "초대 링크를 복사했어요" 토스트.
3. Chrome 시크릿창에서 복사한 URL `/i/{code}` 직접 열기 → 다른 카카오 계정으로 로그인 → 같은 URL로 자동 복귀(`?next=` 작동) → A의 공개 카드 + "친구 신청" 표시.
4. "친구 신청" 클릭 → "친구 신청을 보냈어요" 표시.
5. 일반창(A) 친구 탭 새로고침 → 상단 "받은 친구 요청 1건" 카드 표시 → "수락" 클릭.
6. 양쪽 친구 목록에 상대 등장.

기대: 끊김 없이 진행됨. Network 탭에서 `searchUsersByNickname`이 시트가 열렸을 때 자동으로 호출되지 않고, 검색어 입력 후 디바운스 300ms 뒤에만 호출되는지 확인.

- [ ] **Step 5: 시연 플로우 B — 닉네임 검색**

1. 시크릿창(B)에서 친구 탭 → `+` → "닉네임으로 찾기"에 A의 닉네임 일부 입력.
2. 결과 카드에 A 표시 (프로필 사진/상태 메시지로 식별 가능) → "친구 신청".
3. 일반창(A)의 받은 요청에서 수락.
4. 양쪽 친구 목록 확인.

- [ ] **Step 6: 엣지케이스 빠른 점검**

- 자기 자신 invite 링크 클릭 → "내 초대 링크예요" 안내.
- 동일인에게 두 번 신청 → "이미 신청을 보냈어요".
- 받은 요청을 거절 → 상단 섹션에서 사라짐 (DB에서 삭제 — RLS delete 정책 확인).
- 빈 닉네임으로 검색 → 결과 없음 (네트워크 요청도 없음).

- [ ] **Step 7: 최종 커밋 (필요 시)**

검증 중 발견된 자잘한 수정만 커밋. 통과되면 따로 커밋 없음.

```bash
git status
```

---

## Self-Review 결과

- ✅ Spec 섹션 매핑: 데이터 모델→Task 1, 보안 모델→Task 5/8/13, 서버 액션→Task 5–8, UI→Task 10–14, 초대 페이지→Task 15–16, 시연→Task 17.
- ✅ Placeholder 없음. 모든 코드 블록은 실행 가능한 형태로 채움.
- ✅ 타입 일관성: `Result<T>` (5–7), `PublicUser | null` (8), `relationship: 'none'|'pending_sent'|'pending_received'|'accepted'`(3,5,10) 모두 일치.
- ✅ `mapPublicUser` 시그니처를 row의 안전한 부분집합(`PublicUserRow`)으로 좁혀 Task 5/13에서 캐스팅 없이 매핑.
- ✅ 거절(DELETE)을 위한 RLS 정책은 Task 1에 포함. 그 정책 없이 Task 7의 reject가 실행되면 무음 실패하므로 Task 1을 먼저 적용해야 함 (실행 순서 강제).
- ✅ 시연 플로우 두 가지가 Task 17에 명시.
