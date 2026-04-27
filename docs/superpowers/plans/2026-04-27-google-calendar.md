# Google Calendar 연동 + 개인 일정 직접 추가 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Google Calendar 읽기 전용 OAuth 연동을 추가해 사용자의 외부 일정을 홈에 personal 일정 형태로 흡수하고, group 모임 카드와 시간이 겹치면 amber 배경으로 충돌 표시한다. (2) 사용자가 우리 앱 안에서 직접 personal 일정을 추가/편집/삭제할 수 있는 바텀시트 UI를 추가한다. 두 기능 모두 `schedules` 테이블을 공유하며 `source` 컬럼(`'manual'` | `'google'`)으로 구분한다.

**Architecture:** Google OAuth 2.0 (`access_type=offline`, `calendar.readonly`) → refresh token을 `users` 테이블에 저장. Sync 로직은 server-side에서 access token 발급 → 다음 30일 이벤트 fetch → `schedules` 테이블에 `source='google'`로 upsert. 홈 진입 시 last sync로부터 1시간 경과면 백그라운드 sync. UI는 기존 `DayEventList`/`MonthlyCalendar` 재사용 + 충돌 감지 헬퍼 추가.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind · shadcn/ui · Supabase(Postgres + RLS + admin SDK) · Google Calendar API v3 · Vitest.

**Spec:** [`docs/superpowers/specs/2026-04-27-google-calendar-design.md`](../specs/2026-04-27-google-calendar-design.md)

**병렬 작업 가이드:** 친구 추가(`docs/superpowers/plans/2026-04-27-friend-add.md`)와 worktree 분리 후 병렬 진행 가능. 충돌 가능 파일은 `src/types/index.ts`, `src/types/supabase.ts`뿐. 머지 시점에 두 마이그레이션 순서대로 (004 → 005) 적용 후 `pnpm db:types` 한 번만 실행.

---

## File Structure

**신규**
- `supabase/migrations/005_google_calendar.sql`
- `src/lib/google/oauth.ts` (OAuth URL 생성, code/refresh token 교환)
- `src/lib/google/calendar-api.ts` (Calendar API 클라이언트)
- `src/lib/google/sync.ts` (sync 로직)
- `src/lib/google/__tests__/sync.test.ts`
- `src/lib/schedule-conflict.ts` + `src/lib/__tests__/schedule-conflict.test.ts`
- `src/app/api/auth/google/connect/route.ts`
- `src/app/api/auth/google/callback/route.ts`
- `src/app/api/google/sync/route.ts`
- `src/app/api/google/disconnect/route.ts`
- `src/app/(main)/home/schedule-actions.ts` (personal schedule CRUD server actions)
- `src/components/calendar/GoogleConnectButton.tsx`
- `src/components/calendar/GoogleSyncIndicator.tsx`
- `src/components/calendar/ReauthBanner.tsx`
- `src/components/calendar/AddPersonalScheduleButton.tsx`
- `src/components/calendar/AddPersonalScheduleSheet.tsx`
- `src/components/calendar/PersonalScheduleActionSheet.tsx`

**수정**
- `src/types/index.ts` — `Schedule`에 `source`, `externalEventId` 필드
- `src/lib/mappers.ts` — `mapSchedule` source/externalEventId 매핑
- `src/components/calendar/DayEventList.tsx` — 충돌 감지, amber 배경, Google 아이콘
- `src/components/calendar/MonthlyCalendar.tsx` — Google 일정 점도 함께 표시 (자동 동작 확인만)
- `src/app/(main)/home/page.tsx` — stale 체크 + 백그라운드 sync 트리거 + ReauthBanner
- `src/app/profile/page.tsx` 또는 신규 — GoogleConnectButton 배치
- `src/types/supabase.ts` — `pnpm db:types`로 재생성
- `.env.local` — `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`

---

## Task 1: 마이그레이션 (Schedule.source/externalEventId + users.google_*)

**Files:**
- Create: `supabase/migrations/005_google_calendar.sql`
- Modify: `src/types/supabase.ts` (재생성)

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- ============================================================
-- 005_google_calendar.sql
-- Google Calendar 연동: schedules.source/external_event_id + users.google_*
-- ============================================================

-- 1. schedules 테이블 확장
alter table schedules add column source text not null default 'manual'
  check (source in ('manual', 'google'));
alter table schedules add column external_event_id text;
alter table schedules add column external_etag text;

create unique index schedules_user_external_unique_idx
  on schedules(user_id, external_event_id)
  where external_event_id is not null;

-- 2. users 테이블 확장
alter table users add column google_refresh_token text;
alter table users add column google_calendar_email text;
alter table users add column google_calendar_synced_at timestamptz;
```

- [ ] **Step 2: 마이그레이션 적용**

```bash
# Supabase 로컬 또는 원격에 적용
# 사용자 환경에 따라 명령어 다름. supabase CLI 또는 dashboard SQL editor.
```

- [ ] **Step 3: 타입 재생성**

```bash
pnpm db:types
```

- [ ] **Step 4: 검증**

```bash
pnpm typecheck
```

기존 `Schedule` 사용처가 깨지면 mapper에서 default `source='manual'` 채움.

---

## Task 2: 타입 + Mapper 업데이트

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/mappers.ts`

- [ ] **Step 1: `Schedule` 타입 확장**

```ts
export type ScheduleSource = "manual" | "google";

export type Schedule = {
  id: string;
  userId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  memo: string | null;
  type: "personal" | "group";
  source: ScheduleSource;
  externalEventId: string | null;
};
```

- [ ] **Step 2: `mapSchedule` 업데이트**

```ts
export function mapSchedule(row: SchedulesRow): Schedule {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    memo: row.memo,
    type: row.type,
    source: row.source,
    externalEventId: row.external_event_id,
  };
}
```

- [ ] **Step 3: typecheck 통과 확인**

```bash
pnpm typecheck
```

---

## Task 3: 충돌 감지 헬퍼

**Files:**
- Create: `src/lib/schedule-conflict.ts`
- Create: `src/lib/__tests__/schedule-conflict.test.ts`

- [ ] **Step 1: 헬퍼 작성**

```ts
import type { Schedule } from "@/types";

export function hasTimeOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function hasConflict(target: Schedule, others: Schedule[]): boolean {
  return others.some(
    (o) =>
      o.id !== target.id &&
      o.date === target.date &&
      hasTimeOverlap(target, o)
  );
}

export function findConflictingGroupIds(daySchedules: Schedule[]): Set<string> {
  const personals = daySchedules.filter((s) => s.type === "personal");
  return new Set(
    daySchedules
      .filter((s) => s.type === "group" && hasConflict(s, personals))
      .map((s) => s.id)
  );
}
```

- [ ] **Step 2: 테스트 작성**

테스트 케이스:
- 시간 완전 일치
- 일부 겹침 (시작/끝 부분)
- 한쪽이 다른 쪽 포함
- 종일 이벤트(00:00~23:59)와 부분 겹침
- 인접하지만 안 겹침 (`14:00~15:00`과 `15:00~16:00`)
- 다른 날짜 → 안 겹침
- 빈 배열 → false

- [ ] **Step 3: 테스트 통과**

```bash
pnpm test src/lib/__tests__/schedule-conflict.test.ts
```

---

## Task 4: Google OAuth 라이브러리

**Files:**
- Create: `src/lib/google/oauth.ts`

- [ ] **Step 1: 환경 변수 검증 헬퍼**

```ts
function getEnv() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GOOGLE_OAUTH_* env vars not set");
  }
  return { clientId, clientSecret, redirectUri };
}
```

- [ ] **Step 2: Consent URL 생성 함수**

```ts
export function buildGoogleConsentUrl(state: string): string {
  const { clientId, redirectUri } = getEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
```

- [ ] **Step 3: Code → Tokens 교환**

```ts
export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token: string;
};

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Refresh token → Access token 발급**

```ts
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const { clientId, clientSecret } = getEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (res.status === 400 || res.status === 401) {
    throw new Error("REAUTH_REQUIRED");
  }
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 5: id_token에서 email 추출**

JWT decode 라이브러리 없이 base64 디코드만 하면 됨 (서명 검증은 Google이 했음, 신뢰):

```ts
export function extractEmailFromIdToken(idToken: string): string | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    return payload.email ?? null;
  } catch {
    return null;
  }
}
```

---

## Task 5: Google Calendar API 클라이언트

**Files:**
- Create: `src/lib/google/calendar-api.ts`

- [ ] **Step 1: 이벤트 타입 정의**

```ts
export type GoogleEvent = {
  id: string;
  summary?: string;
  visibility?: "default" | "public" | "private" | "confidential";
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  status: "confirmed" | "tentative" | "cancelled";
  etag?: string;
};
```

- [ ] **Step 2: events.list 호출**

```ts
export async function listPrimaryEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 401) throw new Error("REAUTH_REQUIRED");
  if (!res.ok) throw new Error(`Calendar API failed: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).filter(
    (e: GoogleEvent) => e.status !== "cancelled"
  );
}
```

---

## Task 6: Sync 로직

**Files:**
- Create: `src/lib/google/sync.ts`
- Create: `src/lib/google/__tests__/sync.test.ts`

- [ ] **Step 1: GoogleEvent → Schedule 변환 헬퍼**

```ts
import { format, toZonedTime } from "date-fns-tz";  // 이미 설치되어 있는지 확인
const KST = "Asia/Seoul";

export function googleEventToScheduleInsert(
  event: GoogleEvent,
  userId: string
): SchedulesInsert {
  const isAllDay = !!event.start.date;
  const title =
    event.visibility === "private"
      ? "(비공개 일정)"
      : event.summary ?? "제목 없음";

  if (isAllDay) {
    return {
      user_id: userId,
      title,
      date: event.start.date!,
      start_time: "00:00",
      end_time: "23:59",
      memo: null,
      type: "personal",
      source: "google",
      external_event_id: event.id,
      external_etag: event.etag ?? null,
    };
  }

  const startDt = toZonedTime(new Date(event.start.dateTime!), KST);
  const endDt = toZonedTime(new Date(event.end.dateTime!), KST);
  return {
    user_id: userId,
    title,
    date: format(startDt, "yyyy-MM-dd", { timeZone: KST }),
    start_time: format(startDt, "HH:mm", { timeZone: KST }),
    end_time: format(endDt, "HH:mm", { timeZone: KST }),
    memo: null,
    type: "personal",
    source: "google",
    external_event_id: event.id,
    external_etag: event.etag ?? null,
  };
}
```

- [ ] **Step 2: 메인 sync 함수**

```ts
export type SyncResult =
  | { ok: true; data: { added: number; updated: number; removed: number } }
  | { ok: false; error: "NOT_CONNECTED" | "REAUTH_REQUIRED" | "UNKNOWN" };

export async function syncUserGoogleCalendar(
  userId: string
): Promise<SyncResult> {
  const admin = createAdminClient();

  // 1. refresh token 조회
  const { data: user } = await admin
    .from("users")
    .select("google_refresh_token")
    .eq("id", userId)
    .single();
  if (!user?.google_refresh_token) return { ok: false, error: "NOT_CONNECTED" };

  // 2. access token 발급
  let accessToken: string;
  try {
    const tokens = await refreshAccessToken(user.google_refresh_token);
    accessToken = tokens.access_token;
  } catch (e) {
    if ((e as Error).message === "REAUTH_REQUIRED") {
      await admin
        .from("users")
        .update({ google_refresh_token: null })
        .eq("id", userId);
      return { ok: false, error: "REAUTH_REQUIRED" };
    }
    return { ok: false, error: "UNKNOWN" };
  }

  // 3. 이벤트 fetch
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const events = await listPrimaryEvents(accessToken, now, in30d);

  // 4. 변환
  const incoming = events.map((e) => googleEventToScheduleInsert(e, userId));

  // 5. 기존 행 조회
  const { data: existing } = await admin
    .from("schedules")
    .select("id, external_event_id, title, date, start_time, end_time")
    .eq("user_id", userId)
    .eq("source", "google")
    .gte("date", format(now, "yyyy-MM-dd"))
    .lte("date", format(in30d, "yyyy-MM-dd"));

  const existingMap = new Map(
    (existing ?? []).map((s) => [s.external_event_id!, s])
  );
  const incomingIds = new Set(incoming.map((i) => i.external_event_id!));

  // 6. diff
  const toInsert = incoming.filter(
    (i) => !existingMap.has(i.external_event_id!)
  );
  const toUpdate = incoming.filter((i) => {
    const ex = existingMap.get(i.external_event_id!);
    if (!ex) return false;
    return (
      ex.title !== i.title ||
      ex.date !== i.date ||
      ex.start_time !== i.start_time ||
      ex.end_time !== i.end_time
    );
  });
  const toDeleteIds = (existing ?? [])
    .filter((s) => !incomingIds.has(s.external_event_id!))
    .map((s) => s.id);

  // 7. 적용
  if (toInsert.length > 0) {
    await admin.from("schedules").insert(toInsert);
  }
  for (const u of toUpdate) {
    await admin
      .from("schedules")
      .update({
        title: u.title,
        date: u.date,
        start_time: u.start_time,
        end_time: u.end_time,
      })
      .eq("user_id", userId)
      .eq("external_event_id", u.external_event_id!);
  }
  if (toDeleteIds.length > 0) {
    await admin.from("schedules").delete().in("id", toDeleteIds);
  }

  // 8. synced_at 업데이트
  await admin
    .from("users")
    .update({ google_calendar_synced_at: new Date().toISOString() })
    .eq("id", userId);

  revalidatePath("/home");

  return {
    ok: true,
    data: {
      added: toInsert.length,
      updated: toUpdate.length,
      removed: toDeleteIds.length,
    },
  };
}
```

- [ ] **Step 3: 테스트**

테스트 케이스:
- 종일 이벤트 → 00:00/23:59 매핑
- 시간 이벤트 KST 변환 (UTC `2026-04-30T05:00:00Z` → KST `14:00`)
- private visibility → "(비공개 일정)"
- summary 없음 → "제목 없음"
- diff: 추가/업데이트/삭제 케이스 분리

- [ ] **Step 4: typecheck + test**

```bash
pnpm typecheck && pnpm test src/lib/google
```

---

## Task 7: OAuth 라우트 (`/api/auth/google/connect` + callback)

**Files:**
- Create: `src/app/api/auth/google/connect/route.ts`
- Create: `src/app/api/auth/google/callback/route.ts`

- [ ] **Step 1: connect 라우트**

```ts
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildGoogleConsentUrl } from "@/lib/google/oauth";

export async function GET() {
  const state = randomBytes(32).toString("hex");
  const url = buildGoogleConsentUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 2: callback 라우트**

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  extractEmailFromIdToken,
} from "@/lib/google/oauth";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncUserGoogleCalendar } from "@/lib/google/sync";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL("/profile?google=invalid", req.url));
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch {
    return NextResponse.redirect(new URL("/profile?google=error", req.url));
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      new URL("/profile?google=norefresh", req.url)
    );
  }

  const email = extractEmailFromIdToken(tokens.id_token);

  const admin = createAdminClient();
  await admin
    .from("users")
    .update({
      google_refresh_token: tokens.refresh_token,
      google_calendar_email: email,
    })
    .eq("id", user.id);

  await syncUserGoogleCalendar(user.id);

  const res = NextResponse.redirect(new URL("/home?google=connected", req.url));
  res.cookies.delete("google_oauth_state");
  return res;
}
```

- [ ] **Step 3: 환경 변수 추가**

`.env.local`:
```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Google Cloud Console에서 OAuth 2.0 Client ID 발급 + Authorized redirect URI 등록 필요. 작업자가 setup 필요.

---

## Task 8: Sync / Disconnect 라우트

**Files:**
- Create: `src/app/api/google/sync/route.ts`
- Create: `src/app/api/google/disconnect/route.ts`

- [ ] **Step 1: sync 라우트**

```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncUserGoogleCalendar } from "@/lib/google/sync";

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const result = await syncUserGoogleCalendar(user.id);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: disconnect 라우트**

```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("users")
    .update({
      google_refresh_token: null,
      google_calendar_email: null,
      google_calendar_synced_at: null,
    })
    .eq("id", user.id);
  await admin
    .from("schedules")
    .delete()
    .eq("user_id", user.id)
    .eq("source", "google");

  return NextResponse.json({ ok: true });
}
```

---

## Task 9: 충돌 표시 (`DayEventList` 수정)

**Files:**
- Modify: `src/components/calendar/DayEventList.tsx`

- [ ] **Step 1: 충돌 ID 계산**

`DayEventList` 함수 내부에서:
```ts
import { findConflictingGroupIds } from "@/lib/schedule-conflict";

const conflictingGroupIds = findConflictingGroupIds(daySchedules);
```

- [ ] **Step 2: 카드 렌더링 분기**

```tsx
const isConflict = isGroup && conflictingGroupIds.has(schedule.id);

<motion.div
  className={cn(
    "border rounded-xl p-4 flex gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
    isConflict
      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
      : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
  )}
>
  <div
    className={cn(
      "w-[3px] rounded-full shrink-0",
      isConflict
        ? "bg-amber-500"
        : isGroup
          ? "bg-violet-600"
          : "bg-gray-300 dark:bg-gray-600"
    )}
  />
  {/* ... 기존 내용 ... */}
  {isConflict && (
    <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
      ⚠ 내 일정과 겹쳐요
    </p>
  )}
</motion.div>
```

- [ ] **Step 3: Google 일정 아이콘**

`source === "google"` 인 personal 카드에 제목 옆 작은 Google 아이콘 표시:

```tsx
{schedule.source === "google" && (
  <span
    aria-label="Google 캘린더 일정"
    className="inline-block w-3 h-3 ml-1 align-middle text-gray-400"
  >
    {/* Google G 아이콘 SVG 또는 lucide-react Calendar 아이콘 */}
  </span>
)}
```

---

## Task 10: GoogleConnectButton + SyncIndicator + ReauthBanner

**Files:**
- Create: `src/components/calendar/GoogleConnectButton.tsx`
- Create: `src/components/calendar/GoogleSyncIndicator.tsx`
- Create: `src/components/calendar/ReauthBanner.tsx`

- [ ] **Step 1: GoogleConnectButton**

```tsx
type Props = { connectedEmail: string | null };

export function GoogleConnectButton({ connectedEmail }: Props) {
  if (!connectedEmail) {
    return (
      <a href="/api/auth/google/connect">
        <Button variant="secondary">Google 캘린더 연결</Button>
      </a>
    );
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{connectedEmail} 연결됨</span>
      <button
        onClick={async () => {
          await fetch("/api/google/disconnect", { method: "POST" });
          location.reload();
        }}
        className="text-xs text-gray-400 underline"
      >
        해제
      </button>
    </div>
  );
}
```

- [ ] **Step 2: GoogleSyncIndicator** — 마지막 sync 시각 + 새로고침 버튼

```tsx
"use client";
type Props = { syncedAt: string | null };

export function GoogleSyncIndicator({ syncedAt }: Props) {
  if (!syncedAt) return null;
  const ago = formatDistanceToNow(new Date(syncedAt), { addSuffix: true, locale: ko });
  return (
    <button
      onClick={async () => {
        await fetch("/api/google/sync", { method: "POST" });
        location.reload();
      }}
      className="text-xs text-gray-400 flex items-center gap-1"
    >
      <RefreshCw size={12} />
      {ago} 동기화
    </button>
  );
}
```

- [ ] **Step 3: ReauthBanner** — refresh token NULL일 때만 표시

```tsx
type Props = { needsReauth: boolean };

export function ReauthBanner({ needsReauth }: Props) {
  if (!needsReauth) return null;
  return (
    <a
      href="/api/auth/google/connect"
      className="block mx-5 mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800"
    >
      ⚠ Google 캘린더 재연결이 필요해요. 탭하여 다시 연결하세요.
    </a>
  );
}
```

---

## Task 11: 홈 페이지 통합 (stale 체크 + 백그라운드 sync + 배너)

**Files:**
- Modify: `src/app/(main)/home/page.tsx`

- [ ] **Step 1: users 행 조회 추가**

```ts
const [
  { data: schedulesData },
  { data: groupsData },
  { data: userData },
] = await Promise.all([
  // ...
  supabase
    .from("users")
    .select("google_refresh_token, google_calendar_email, google_calendar_synced_at")
    .eq("id", currentUserId)
    .single(),
]);
```

- [ ] **Step 2: stale 체크 + 백그라운드 sync (fire-and-forget)**

```ts
const syncedAt = userData?.google_calendar_synced_at;
const hasToken = !!userData?.google_refresh_token;
const isStale =
  hasToken &&
  (!syncedAt || Date.now() - new Date(syncedAt).getTime() > 60 * 60 * 1000);

if (isStale) {
  // fire and forget — 페이지 렌더 블록하지 않음
  syncUserGoogleCalendar(currentUserId).catch(() => {});
}

const needsReauth = !hasToken && !!userData?.google_calendar_email;
// (이전에 연결됐다가 token 만료된 상태)
```

- [ ] **Step 3: ReauthBanner + GoogleSyncIndicator 배치**

```tsx
<HomeCalendarView ... />
<ReauthBanner needsReauth={needsReauth} />
<GoogleSyncIndicator syncedAt={syncedAt} />
```

`needsReauth` 판단을 위해 `google_calendar_email`이 한번 채워졌다가 `google_refresh_token`이 NULL이 된 상태 = "이전에 연결됐는데 끊김". MVP는 단순히 둘의 조합으로 판단.

- [ ] **Step 4: lint + typecheck**

```bash
pnpm typecheck && pnpm lint
```

---

## Task 12: 프로필 페이지에 GoogleConnectButton 배치

**Files:**
- Modify: `src/app/profile/page.tsx` (또는 신규)

- [ ] **Step 1: 프로필 페이지가 있는지 확인**

없으면 `src/app/profile/page.tsx` 생성. 사용자 정보 + GoogleConnectButton 배치.

- [ ] **Step 2: GoogleConnectButton에 connectedEmail prop 전달**

```tsx
const { data: user } = await supabase
  .from("users")
  .select("google_calendar_email")
  .eq("id", currentUserId)
  .single();

<GoogleConnectButton connectedEmail={user?.google_calendar_email ?? null} />
```

---

## Task 13: 시연 검증

**Files:** 없음 (수동 검증)

- [ ] **Step 1: Google Cloud Console에서 OAuth Client 발급**

- Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
- Calendar API 활성화

- [ ] **Step 2: `.env.local` 채우기 + 서버 재시작**

- [ ] **Step 3: 시나리오 A 검증 (처음 연결)**

1. 프로필 페이지 → "Google 캘린더 연결" 클릭
2. Google consent 화면 → 동의
3. `/home`으로 redirect
4. 사용자의 구글 캘린더 일정이 personal 카드로 표시되는지 확인
5. MonthlyCalendar 점이 더 많아진 것 확인

- [ ] **Step 4: 시나리오 B 검증 (충돌 표시)**

1. Google 캘린더에 임의 시간(예: 4/30 14:00~16:00)에 일정 만들기
2. 우리 앱에서 같은 시간대 group 모임 만들기 (또는 기존 모임 확정)
3. 4/30 클릭 → group 카드가 amber 배경으로 표시되는지 확인
4. "내 일정과 겹쳐요" 라벨 표시 확인

- [ ] **Step 5: 시나리오 C 검증 (해제)**

1. 프로필 → "해제" 클릭
2. `source='google'` 일정이 모두 사라지는지 확인
3. MonthlyCalendar 점도 줄어드는지 확인

- [ ] **Step 6: 시나리오 D 검증 (token 무효화)**

1. Google 보안 설정(myaccount.google.com/permissions)에서 우리 앱 액세스 제거
2. 홈 새로고침 → ReauthBanner 표시 확인
3. 배너 클릭 → 재연결 가능 확인

- [ ] **Step 7: 친구 추가와 충돌 없음 확인**

친구 추가 worktree에서 동시 진행 중인 경우, 머지 시점에 마이그레이션 순서(004 → 005) + `pnpm db:types` 한 번 실행으로 정리 가능한지 확인.

---

## Task 14: 개인 일정 추가 — server action + 바텀시트 + 진입 버튼

**Files:**
- Create: `src/app/(main)/home/schedule-actions.ts`
- Create: `src/components/calendar/AddPersonalScheduleSheet.tsx`
- Create: `src/components/calendar/AddPersonalScheduleButton.tsx`
- Modify: `src/app/(main)/home/page.tsx` (헤더 우상단에 추가 버튼)
- Modify: `src/components/calendar/HomeCalendarView.tsx` (빈 상태에 "내 일정 추가" 버튼)

- [ ] **Step 1: server action 작성**

```ts
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type PersonalScheduleInput = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  memo: string | null;
  isAllDay: boolean;
};

function validate(input: PersonalScheduleInput): string | null {
  if (!input.title.trim() || input.title.length > 80) return "INVALID_TITLE";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "INVALID_DATE";
  if (!input.isAllDay) {
    if (input.startTime >= input.endTime) return "INVALID_TIME_RANGE";
  }
  if (input.memo && input.memo.length > 200) return "MEMO_TOO_LONG";
  return null;
}

export async function createPersonalSchedule(
  input: PersonalScheduleInput
): Promise<Result<{ id: string }>> {
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHORIZED" };

  const { data, error } = await supabase
    .from("schedules")
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      date: input.date,
      start_time: input.isAllDay ? "00:00" : input.startTime,
      end_time: input.isAllDay ? "23:59" : input.endTime,
      memo: input.memo?.trim() || null,
      type: "personal",
      source: "manual",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true, data: { id: data.id } };
}
```

- [ ] **Step 2: AddPersonalScheduleSheet 컴포넌트**

shadcn/ui Sheet (또는 기존 친구 추가 plan의 AddFriendSheet 컴포넌트 패턴 참고). 다음 필드:
- 제목: `<input type="text" maxLength={80}>`
- 날짜: `<input type="date">` (기본값 = props로 받은 selectedDate)
- 종일 토글: `<Switch>` 또는 `<input type="checkbox">`
- 시작/종료 시간: 종일 OFF일 때만 표시, `<input type="time" step={1800}>` (30분 단위)
- 메모: `<textarea maxLength={200}>`
- 저장 버튼: 클릭 시 `createPersonalSchedule` 호출, 성공 시 `router.refresh()` + 시트 닫기, 실패 시 에러 토스트.
- 취소 버튼: 시트 닫기.

props:
```ts
type Props = {
  open: boolean;
  onClose: () => void;
  defaultDate: Date;
};
```

- [ ] **Step 3: AddPersonalScheduleButton (헤더 우상단)**

```tsx
"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AddPersonalScheduleSheet } from "./AddPersonalScheduleSheet";

type Props = { defaultDate?: Date };

export function AddPersonalScheduleButton({ defaultDate }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-label="내 일정 추가"
        onClick={() => setOpen(true)}
        className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all min-h-11 min-w-11"
      >
        <Plus size={20} className="text-gray-700 dark:text-gray-300" strokeWidth={2} />
      </button>
      <AddPersonalScheduleSheet
        open={open}
        onClose={() => setOpen(false)}
        defaultDate={defaultDate ?? new Date()}
      />
    </>
  );
}
```

- [ ] **Step 4: 홈 페이지 헤더에 배치**

`src/app/(main)/home/page.tsx`:
```tsx
<div className="flex items-center justify-between px-5 pt-5 pb-2">
  <h1 className="text-[22px] font-semibold text-gray-800 dark:text-gray-100">된다</h1>
  <div className="flex items-center gap-2">
    <AddPersonalScheduleButton />
    <LogoutButton />
  </div>
</div>
```

- [ ] **Step 5: HomeCalendarView 빈 상태에 보조 버튼**

```tsx
{!hasEventOnSelected && (
  <div className="px-5 mt-4 flex flex-col gap-2">
    <Link href="/create">
      <Button variant="secondary">모임 만들기</Button>
    </Link>
    <Button
      variant="ghost"
      onClick={() => setAddSheetOpen(true)}
    >
      내 일정 추가
    </Button>
  </div>
)}
```

`HomeCalendarView`에 `addSheetOpen` 상태 + `<AddPersonalScheduleSheet>` 렌더 추가. `selectedDate`를 `defaultDate`로 전달.

- [ ] **Step 6: typecheck + 수동 검증**

```bash
pnpm typecheck
```

수동: 헤더 + 빈 상태 둘 다 작동, 저장 후 즉시 카드로 표시되는지 확인.

---

## Task 15: 개인 일정 편집/삭제 — 액션 시트 + UPDATE/DELETE

**Files:**
- Create: `src/components/calendar/PersonalScheduleActionSheet.tsx`
- Modify: `src/app/(main)/home/schedule-actions.ts` (UPDATE/DELETE 추가)
- Modify: `src/components/calendar/AddPersonalScheduleSheet.tsx` (편집 모드 지원)
- Modify: `src/components/calendar/DayEventList.tsx` (long-press 핸들러)

- [ ] **Step 1: server action 추가**

```ts
export async function updatePersonalSchedule(
  id: string,
  input: PersonalScheduleInput
): Promise<Result<void>> {
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHORIZED" };

  // source='google' 행은 차단
  const { data: existing } = await supabase
    .from("schedules")
    .select("source")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { ok: false, error: "NOT_FOUND" };
  if (existing.source === "google") return { ok: false, error: "GOOGLE_NOT_EDITABLE" };

  const { error } = await supabase
    .from("schedules")
    .update({
      title: input.title.trim(),
      date: input.date,
      start_time: input.isAllDay ? "00:00" : input.startTime,
      end_time: input.isAllDay ? "23:59" : input.endTime,
      memo: input.memo?.trim() || null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true, data: undefined };
}

export async function deletePersonalSchedule(
  id: string
): Promise<Result<void>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHORIZED" };

  const { data: existing } = await supabase
    .from("schedules")
    .select("source")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { ok: false, error: "NOT_FOUND" };
  if (existing.source === "google") return { ok: false, error: "GOOGLE_NOT_EDITABLE" };

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: PersonalScheduleActionSheet 컴포넌트**

```tsx
type Props = {
  open: boolean;
  schedule: Schedule | null;
  onClose: () => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
};
```

shadcn/ui Sheet (bottom). 세 버튼: "편집", "삭제"(빨간색), "취소".

- [ ] **Step 3: AddPersonalScheduleSheet에 편집 모드 추가**

props 확장:
```ts
type Props = {
  open: boolean;
  onClose: () => void;
  defaultDate: Date;
  editingSchedule?: Schedule | null;
};
```

`editingSchedule`이 있으면 모든 필드 prefill, 저장 시 `updatePersonalSchedule(editingSchedule.id, input)`. 없으면 `createPersonalSchedule(input)`.

시트 헤더 텍스트도 분기: 신규는 "내 일정 추가", 편집은 "내 일정 수정".

- [ ] **Step 4: DayEventList — long-press 핸들러**

`DayEventList`에 `onSelectSchedule(schedule)` 콜백 prop 추가. personal 카드(`schedule.type === "personal" && schedule.source === "manual"`)에 long-press 핸들러 부착:

```ts
function useLongPress(callback: () => void, ms = 300) {
  const timer = useRef<NodeJS.Timeout | null>(null);
  return {
    onPointerDown: () => {
      timer.current = setTimeout(callback, ms);
    },
    onPointerUp: () => {
      if (timer.current) clearTimeout(timer.current);
    },
    onPointerLeave: () => {
      if (timer.current) clearTimeout(timer.current);
    },
  };
}
```

`source === "google"` 카드는 long-press 비활성. 시각적으로는 동일하되 길게 눌러도 액션 시트 안 뜸.

- [ ] **Step 5: HomeCalendarView 통합**

상태 추가:
```ts
const [actionSchedule, setActionSchedule] = useState<Schedule | null>(null);
const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
const [addSheetOpen, setAddSheetOpen] = useState(false);
```

흐름:
1. `DayEventList`에 `onSelectSchedule={(s) => setActionSchedule(s)}` 전달
2. `<PersonalScheduleActionSheet>` 마운트 — `schedule={actionSchedule}`, `onEdit`/`onDelete` 처리
3. 편집 클릭 시: `setEditingSchedule(actionSchedule); setActionSchedule(null); setAddSheetOpen(true);`
4. 삭제 클릭 시: `confirm()` → `deletePersonalSchedule(s.id)` → `router.refresh()`
5. AddSheet의 onClose에서 `setEditingSchedule(null)`도 같이 처리.

- [ ] **Step 6: 시연 검증**

1. personal 카드 길게 누름 → 액션 시트 뜸
2. 편집 → 시트 prefill → 수정 → 저장 → 카드 즉시 갱신
3. 삭제 → 확인 → 카드 사라짐
4. Google source 카드는 길게 눌러도 반응 없음

---

## 완료 기준

- [ ] 모든 task의 모든 step 체크박스 완료
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 모두 통과
- [ ] 시연 시나리오 A, B, C, D 수동 검증 통과
- [ ] 개인 일정 추가/편집/삭제 동작 확인 + Google 카드 편집 차단 확인
- [ ] friend-add plan과 별도 worktree에서 충돌 없이 머지 가능

## 후속 작업 (Out of scope, MVP 이후)

- Apple Calendar 지원 (CalDAV 또는 ICS export)
- Multi-calendar 지원 (사용자가 여러 구글 캘린더 가질 때)
- Webhook 기반 실시간 sync
- 시간표 투표(when2meet) 화면에서 자동 X 마킹 (현재는 홈 충돌 표시만)
- Google에 우리 모임 일정 쓰기(write 스코프) — 현재는 read-only
