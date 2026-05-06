# Share Link OG Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카톡/슬랙/iMessage 등에서 공유된 친구 초대 링크(`/i/[code]`)와 모임 투표 링크(`/g/[code]`)가 각각 다른 미리보기 문구를 보여주도록 한다.

**Architecture:** 두 페이지에 Next.js App Router의 `generateMetadata`를 추가해 동적 metadata를 생성한다. 친구 초대는 기존 `getInviteUserByCode` 헬퍼를 재사용하고, 모임 페이지는 inline DB 쿼리를 작은 helper(`getGroupByInviteCode`)로 추출해서 페이지·metadata 양쪽에서 공유한다. OG 이미지는 추가하지 않는다.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase admin client.

**Spec:** [docs/superpowers/specs/2026-05-06-share-link-og-metadata-design.md](../specs/2026-05-06-share-link-og-metadata-design.md)

---

## File Structure

| 파일 | 역할 | 상태 |
|---|---|---|
| `src/lib/groups/getGroupByInviteCode.ts` | invite_code로 group을 조회하는 admin-side helper | 신규 |
| `src/app/g/[code]/page.tsx` | inline 쿼리를 헬퍼로 교체 + `generateMetadata` 추가 | 수정 |
| `src/app/i/[code]/page.tsx` | `generateMetadata` 추가 | 수정 |

---

### Task 1: `getGroupByInviteCode` 헬퍼 신규 작성

**Files:**
- Create: `src/lib/groups/getGroupByInviteCode.ts`

- [ ] **Step 1: 헬퍼 파일 생성**

같은 RSC 요청 안에서 `generateMetadata`와 page default export가 순차적으로 같은 헬퍼를 호출하므로, `React.cache()`로 감싸 1회 호출로 dedupe한다(헬퍼 내부에서 `createAdminClient()`를 새로 만들지 않게 됨).

```ts
// src/lib/groups/getGroupByInviteCode.ts
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type GroupByInviteCode = {
  id: string;
  name: string;
  status: string;
  confirmed_date: string | null;
  confirmed_start_time: string | null;
  confirmed_end_time: string | null;
};

export const getGroupByInviteCode = cache(
  async (code: string): Promise<GroupByInviteCode | null> => {
    const trimmed = code.trim();
    if (trimmed.length === 0) return null;

    const admin = createAdminClient();
    // confirmed_* 컬럼이 generated types에 누락돼 있어 (any) 캐스팅.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("groups")
      .select("id, name, status, confirmed_date, confirmed_start_time, confirmed_end_time")
      .eq("invite_code", trimmed)
      .maybeSingle();

    return (data as GroupByInviteCode | null) ?? null;
  }
);
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: PASS (헬퍼만 추가했으므로 기존 코드에 영향 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/lib/groups/getGroupByInviteCode.ts
git commit -m "feat(lib): getGroupByInviteCode helper — invite_code로 group 조회"
```

---

### Task 2: `/g/[code]/page.tsx` 헬퍼 사용으로 리팩토링

**Files:**
- Modify: `src/app/g/[code]/page.tsx`

- [ ] **Step 1: import 추가 + inline 쿼리 제거**

기존 (8~18행):
```ts
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GuestVoteClient } from "./GuestVoteClient";

type Props = { params: Promise<{ code: string }> };

export default async function GuestGroupPage({ params }: Props) {
  const { code } = await params;
  const admin = createAdminClient();

  // confirmed_start_time/end_time이 supabase types에 없을 수 있어 (any) 캐스팅.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: group } = await (admin as any)
    .from("groups")
    .select("id, name, status, confirmed_date, confirmed_start_time, confirmed_end_time")
    .eq("invite_code", code)
    .maybeSingle();
```

대체:
```ts
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGroupByInviteCode } from "@/lib/groups/getGroupByInviteCode";
import { GuestVoteClient } from "./GuestVoteClient";

type Props = { params: Promise<{ code: string }> };

export default async function GuestGroupPage({ params }: Props) {
  const { code } = await params;
  const group = await getGroupByInviteCode(code);
```

(주의: 그 아래 `const admin = createAdminClient();`는 멤버십 조회에서 여전히 쓰이므로, 멤버십 조회 직전 `if (user) { ... }` 안으로 이동시키거나 `if (group) { ... }` 안으로 이동시킨다. 깔끔하게는 `if (user)` 블록 안에서 한 번 더 `createAdminClient()`를 호출하는 형태로 둔다.)

- [ ] **Step 2: 멤버십 조회 부분의 `admin` 변수 위치 조정**

기존:
```ts
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  const { data: membership } = await admin
    .from("group_members")
    ...
```

대체:
```ts
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("group_members")
    ...
```

- [ ] **Step 3: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/app/g/[code]/page.tsx
git commit -m "refactor(guest): inline group 쿼리를 getGroupByInviteCode 헬퍼로 교체"
```

---

### Task 3: `/g/[code]/page.tsx`에 `generateMetadata` 추가

**Files:**
- Modify: `src/app/g/[code]/page.tsx`

- [ ] **Step 1: 파일 상단 import에 `Metadata` 타입 추가**

기존 import 그룹 상단에 한 줄 추가:
```ts
import type { Metadata } from "next";
```

- [ ] **Step 2: `type Props = ...` 다음에 `generateMetadata` 함수 추가**

```ts
export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const { code } = await params;
  const group = await getGroupByInviteCode(code);
  if (!group) return {};

  const isVoting = group.status === "voting";
  const title = isVoting
    ? `${group.name} 투표가 도착했어요`
    : `${group.name} — 투표가 종료됐어요`;
  const description = isVoting
    ? "가능한 시간을 골라주세요"
    : "탭해서 확정된 일정 보기";

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}
```

(`getGroupByInviteCode`가 `React.cache`로 감싸져 있어서 page default export에서 호출되는 두 번째 호출은 첫 호출 결과를 재사용 — DB 추가 쿼리 0.)

- [ ] **Step 2: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 3: dev 서버 띄워 manual 검증**

```bash
pnpm dev
```

새 터미널에서 (실제 invite_code는 DB에서 확인). Windows PowerShell이면 `Select-String`, git bash나 macOS/Linux면 `grep` 사용:

PowerShell:
```powershell
(Invoke-WebRequest http://localhost:3000/g/<voting상태_code>).Content | Select-String -Pattern '<title>|og:title|og:description'
```

git bash / *nix:
```bash
curl -s http://localhost:3000/g/<voting상태_code> | grep -E "<title>|og:title|og:description"
```

Expected: `<title>{group.name} 투표가 도착했어요</title>`, `og:title` / `og:description` 메타 태그 포함.

확정 상태인 그룹이 있으면 그것도 확인 — Expected: `{group.name} — 투표가 종료됐어요`.

유효하지 않은 code (`http://localhost:3000/g/invalid_x` 등) — Expected: 기본 title `된다 — 모임 일정 앱` (root layout 폴백).

- [ ] **Step 4: 커밋**

```bash
git add src/app/g/[code]/page.tsx
git commit -m "feat(meta): /g/[code] OG metadata — 모임 투표 링크 미리보기 문구"
```

---

### Task 4: `/i/[code]/page.tsx`에 `generateMetadata` 추가

**Files:**
- Modify: `src/app/i/[code]/page.tsx`

- [ ] **Step 1: 파일 상단 import에 `Metadata` 타입 추가**

```ts
import type { Metadata } from "next";
```

- [ ] **Step 2: `type Props = ...` 다음에 `generateMetadata` 함수 추가**

```ts
export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const { code } = await params;
  const target = await getInviteUserByCode(code);
  if (!target) return {};

  const nickname = target.nickname?.trim() || "친구";
  const title = `${nickname}님이 친구 추가 요청을 보냈어요`;
  const description = "된다에서 함께 모임을 잡아봐요";

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}
```

- [ ] **Step 3: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 4: dev 서버에서 manual 검증**

(이미 dev 서버가 떠 있어야 함. PowerShell이면 `Invoke-WebRequest | Select-String`, git bash면 `curl | grep`.)

```bash
curl -s http://localhost:3000/i/<유효한_invite_code> | grep -E "<title>|og:title|og:description"
```

Expected: `<title>{nickname}님이 친구 추가 요청을 보냈어요</title>` 등.

유효하지 않은 code (`http://localhost:3000/i/zzzzzz`) — Expected: 기본 title `된다 — 모임 일정 앱`.

- [ ] **Step 5: 커밋**

```bash
git add src/app/i/[code]/page.tsx
git commit -m "feat(meta): /i/[code] OG metadata — 친구 초대 링크 미리보기 문구"
```

---

### Task 5: 최종 검증 + 푸시

- [ ] **Step 1: 전체 typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS

- [ ] **Step 2: 빌드 검증**

```bash
pnpm build
```

Expected: 빌드 성공.

- [ ] **Step 3: 원격 푸시**

```bash
git push
```

---

### Task 6: Vercel CLI로 프로덕션 배포

**Prereq (검증 완료):**
- `.vercel/project.json` 존재 — 프로젝트가 이미 link돼 있음 (`projectName: harness`, `harness-mu.vercel.app`)
- `vercel --version` → CLI 설치됨
- `vercel whoami` → 로그인됨
- 인터랙티브 프롬프트 없이 바로 배포 가능

- [ ] **Step 1: 프로덕션 배포**

프로젝트 루트에서:
```bash
vercel --prod --yes
```

`--yes` 플래그로 어떤 잔여 프롬프트도 자동 승인. Expected: 배포 URL 출력 (`https://harness-mu.vercel.app` 또는 immutable preview URL).

- [ ] **Step 2: 배포 후 OG 미리보기 검증**

배포된 도메인에 대해 curl 테스트 (PowerShell이면 `Invoke-WebRequest`):
```bash
curl -s https://harness-mu.vercel.app/i/<유효한_code> | grep -E "<title>|og:title"
curl -s https://harness-mu.vercel.app/g/<유효한_code> | grep -E "<title>|og:title"
```

Expected: 각각 친구 초대용/모임 투표용 metadata.

(선택) 카톡 채팅창에 링크 붙여서 미리보기 문구 변경 확인.

---

## Verification Summary

| 항목 | 방법 | 통과 기준 |
|---|---|---|
| 타입 안정성 | `pnpm typecheck` | 에러 0 |
| 린트 | `pnpm lint` | 에러 0 |
| 빌드 | `pnpm build` | 성공 |
| 친구 초대 metadata | `curl /i/<code>` 의 `<title>` | `{nickname}님이 친구 추가 요청을 보냈어요` |
| 모임 투표(voting) metadata | `curl /g/<code>` 의 `<title>` | `{group.name} 투표가 도착했어요` |
| 모임 투표(non-voting) metadata | `curl /g/<code>` 의 `<title>` | `{group.name} — 투표가 종료됐어요` |
| 유효하지 않은 code 폴백 | `curl /i/zzzzzz`, `/g/zzzzzzzz` | 기본 `된다 — 모임 일정 앱` |
| 프로덕션 배포 | `vercel --prod` | 배포 URL 응답 200 + 위 4개 metadata 케이스 통과 |
