# 카카오 SDK 공유 — 투표/확정 문구 분기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/group/[id]` 상단 공유 버튼이 카카오 JS SDK Share API를 호출해서 즉시 카톡 미리보기 카드를 띄우게 한다. 그룹 상태(`voting` vs 확정)에 따라 공유 문구를 다르게 보낸다. 그 전제로 누락된 Kakao JS SDK 로드/init 셋업도 함께 한다.

**Architecture:**
1. 카카오 JS SDK(`t1.kakaocdn.net/kakao_js_sdk/...`)를 루트 레이아웃에 로드하고 `Kakao.init`을 1회 호출하는 클라이언트 컴포넌트(`KakaoSdkInitializer`)를 추가한다. 현재 `KakaoMapProvider`는 Maps SDK 전용이라 Share API를 포함하지 않는다 — 친구 추가 카톡 공유도 init이 빠져 항상 클립보드 폴백 상태였음을 함께 해결.
2. `src/lib/share.ts`에 `shareGroupLink` 함수 추가 — `shareInviteLink`와 같은 패턴(SDK 가용 시 `sendDefault`, 실패 시 `navigator.clipboard.writeText`, `ShareResult` 반환).
3. `Group` 타입과 mapper에 `confirmedStartTime`/`confirmedEndTime`을 추가해 SDK 호출 시점에 확정 시간을 미리보기 description으로 전달 가능하게 한다.
4. `GroupDetailClient`의 우상단 버튼이 클립보드 직접 호출 대신 이 함수를 호출하고, 결과는 프로젝트 표준 toast(`sonner`)로 표시한다.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Kakao JS SDK v2, Tailwind, sonner.

**Spec context:**
- 기존 OG metadata 분기 spec: [docs/superpowers/specs/2026-05-06-share-link-og-metadata-design.md](../specs/2026-05-06-share-link-og-metadata-design.md)
- 이 플랜은 metadata 분기와 동일한 카피 톤을 카카오 SDK 호출 시점에도 적용한다.

---

## File Structure

| 파일 | 역할 | 상태 |
|---|---|---|
| `src/components/KakaoSdkInitializer.tsx` | 카카오 JS SDK 1회 로드 + `Kakao.init` | 신규 |
| `src/app/layout.tsx` | `KakaoSdkInitializer` 마운트 | 수정 |
| `src/types/index.ts` | `Group` 타입에 `confirmedStartTime`/`confirmedEndTime` 추가 | 수정 |
| `src/lib/mappers.ts` | `mapGroup`에 확정 시간 매핑 추가 | 수정 |
| `src/lib/share.ts` | `shareGroupLink` 함수 추가 | 수정 |
| `src/app/group/[id]/GroupDetailClient.tsx` | 우상단 버튼이 `shareGroupLink` 호출 + sonner toast | 수정 |

기존 `shareInviteLink`(친구 추가용)는 그대로 둔다. SDK init은 둘 다에 영향을 주므로 친구 추가 카톡 공유도 본 변경 이후엔 카드 미리보기로 동작 — 부수효과로 의도된 회복(regression이 아닌 latent bug 해결).

**도메인 화이트리스트**: Kakao Developers 콘솔에서 JavaScript 키의 "Web 플랫폼"에 배포 도메인(`harness-mu.vercel.app` 등)이 등록돼 있어야 Share API가 실행된다. 미등록 상태에서는 SDK가 silently fail → try/catch → 클립보드 폴백. 본 플랜의 코드 변경만으로는 이 등록을 자동화할 수 없으므로 마지막 검증 단계에 사용자 확인 항목으로 명시.

---

### Task 1: 카카오 JS SDK Initializer 컴포넌트 작성

**Files:**
- Create: `src/components/KakaoSdkInitializer.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
"use client";
import Script from "next/script";

type KakaoWindow = Window & {
  Kakao?: {
    init?: (key: string) => void;
    isInitialized?: () => boolean;
  };
};

const KAKAO_SDK_URL =
  "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
const KAKAO_SDK_INTEGRITY =
  "sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka";

export function KakaoSdkInitializer() {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) return null;

  return (
    <Script
      src={KAKAO_SDK_URL}
      integrity={KAKAO_SDK_INTEGRITY}
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onLoad={() => {
        const w = window as KakaoWindow;
        if (w.Kakao?.init && !w.Kakao.isInitialized?.()) {
          w.Kakao.init(key);
        }
      }}
    />
  );
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/components/KakaoSdkInitializer.tsx
git commit -m "feat(kakao): Kakao JS SDK 로더 컴포넌트 — Share API용 init"
```

---

### Task 2: 루트 레이아웃에 Initializer 마운트

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: import + 마운트**

기존 (3행):

```tsx
import { Toaster } from "sonner";
```

다음 줄에 추가:

```tsx
import { KakaoSdkInitializer } from "@/components/KakaoSdkInitializer";
```

기존 body(19~24행):

```tsx
<body suppressHydrationWarning>
  {children}
  <Toaster position="top-center" richColors closeButton={false} />
</body>
```

다음으로 교체:

```tsx
<body suppressHydrationWarning>
  <KakaoSdkInitializer />
  {children}
  <Toaster position="top-center" richColors closeButton={false} />
</body>
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/app/layout.tsx
git commit -m "feat(kakao): 루트 레이아웃에 Kakao SDK Initializer 마운트"
```

---

### Task 3: `Group` 타입에 확정 시간 필드 + mapper 매핑 추가

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/mappers.ts`

DB 컬럼 `confirmed_start_time`/`confirmed_end_time`은 이미 `src/types/supabase.ts:85-86`에 존재. `Group` 도메인 타입과 mapper만 비어 있는 상태.

- [ ] **Step 1: `Group` 타입 확장**

`src/types/index.ts` 19~30행:

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
```

다음으로 교체:

```ts
export type Group = {
  id: string;
  name: string;
  hostId: string;
  status: GroupStatus;
  confirmedDate: string | null;
  confirmedStartTime: string | null;
  confirmedEndTime: string | null;
  placeId: string | null;
  createdAt: string;
  inviteCode: string | null;
  members: User[];
  guests: Guest[];
};
```

- [ ] **Step 2: `mapGroup` 매핑 추가**

`src/lib/mappers.ts` 21~36행:

```ts
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
```

다음으로 교체:

```ts
export function mapGroup(
  row: Database["public"]["Tables"]["groups"]["Row"]
): Group {
  return {
    id: row.id,
    name: row.name,
    hostId: row.host_id,
    status: row.status,
    confirmedDate: row.confirmed_date,
    confirmedStartTime: row.confirmed_start_time,
    confirmedEndTime: row.confirmed_end_time,
    placeId: row.place_id,
    createdAt: row.created_at,
    inviteCode: row.invite_code ?? null,
    members: [],
    guests: [],
  };
}
```

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: PASS. 신규 필드는 `string | null`로 추가됐고 기존 호출자들이 옵셔널 액세스만 하므로 타입 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/types/index.ts src/lib/mappers.ts
git commit -m "feat(types): Group에 confirmedStartTime/confirmedEndTime 추가 + mapper"
```

---

### Task 4: `shareGroupLink` 함수 추가

**Files:**
- Modify: `src/lib/share.ts`

상태별 문구:

| 상태 | title | description | 버튼 라벨 |
|---|---|---|---|
| `voting` | `{groupName} 투표가 도착했어요` | `가능한 시간을 골라주세요` | `투표 참여하기` |
| 그 외 (확정 시간 다 있음) | `{groupName} 일정이 확정됐어요` | `{date} {start}~{end}` | `일정 보러 가기` |
| 그 외 (확정 시간 없음) | `{groupName} 일정이 확정됐어요` | `확정된 일정을 확인하세요` | `일정 보러 가기` |

- [ ] **Step 1: 함수 추가**

`src/lib/share.ts` 파일 끝(53행 `}` 다음)에 다음을 추가:

```ts
export async function shareGroupLink(args: {
  url: string;
  groupName: string;
  status: string;
  confirmedDate?: string | null;
  confirmedStartTime?: string | null;
  confirmedEndTime?: string | null;
}): Promise<ShareResult> {
  const w = typeof window !== "undefined" ? (window as KakaoShareWindow) : null;

  const isVoting = args.status === "voting";
  const title = isVoting
    ? `${args.groupName} 투표가 도착했어요`
    : `${args.groupName} 일정이 확정됐어요`;

  let description: string;
  if (isVoting) {
    description = "가능한 시간을 골라주세요";
  } else if (
    args.confirmedDate &&
    args.confirmedStartTime &&
    args.confirmedEndTime
  ) {
    description = `${args.confirmedDate} ${args.confirmedStartTime}~${args.confirmedEndTime}`;
  } else {
    description = "확정된 일정을 확인하세요";
  }

  const buttonTitle = isVoting ? "투표 참여하기" : "일정 보러 가기";

  if (w?.Kakao?.isInitialized?.() && w.Kakao.Share?.sendDefault) {
    try {
      w.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title,
          description,
          imageUrl: `${location.origin}/og-invite.png`,
          link: { mobileWebUrl: args.url, webUrl: args.url },
        },
        buttons: [
          {
            title: buttonTitle,
            link: { mobileWebUrl: args.url, webUrl: args.url },
          },
        ],
      });
      return "kakao";
    } catch (e) {
      console.warn("[share] Kakao 실패, 클립보드 폴백", e);
    }
  }

  try {
    await navigator.clipboard.writeText(args.url);
    return "clipboard";
  } catch (e) {
    console.error("[share] 클립보드 실패", e);
    return "failed";
  }
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/share.ts
git commit -m "feat(lib): shareGroupLink — 카톡 SDK + voting/확정 문구 분기"
```

---

### Task 5: `GroupDetailClient` 공유 버튼 교체 (sonner toast)

**Files:**
- Modify: `src/app/group/[id]/GroupDetailClient.tsx`

`linkCopied` state 기반의 자체 토스트를 제거하고, 프로젝트 표준인 `sonner` toast로 교체한다. `useState` + `setTimeout` 자체 구현 제거.

- [ ] **Step 1: import 추가**

기존 (20~21행):

```ts
import type { Vote, VoteChoice, VoteSession, Group, TimeSlot } from "@/types";
import { ChevronLeft, Link2, Check } from "lucide-react";
```

다음으로 교체:

```ts
import type { Vote, VoteChoice, VoteSession, Group, TimeSlot } from "@/types";
import { ChevronLeft, Link2 } from "lucide-react";
import { toast } from "sonner";
import { shareGroupLink } from "@/lib/share";
```

(`Check` 임포트 제거 — 아래서 해당 토글 UI가 사라진다. 만약 GroupDetailClient 다른 곳에서 `Check`를 쓰면 제거하지 말 것. Step 4의 lint에서 잡힘.)

- [ ] **Step 2: state + 핸들러 교체**

기존 (143~152행):

```ts
const [linkCopied, setLinkCopied] = useState(false);

const handleCopyLink = useCallback(async () => {
  const target = group.inviteCode
    ? `${window.location.origin}/g/${group.inviteCode}`
    : window.location.href;
  await navigator.clipboard.writeText(target);
  setLinkCopied(true);
  setTimeout(() => setLinkCopied(false), 2000);
}, [group.inviteCode]);
```

다음으로 교체:

```ts
const handleShare = useCallback(async () => {
  const target = group.inviteCode
    ? `${window.location.origin}/g/${group.inviteCode}`
    : window.location.href;
  const r = await shareGroupLink({
    url: target,
    groupName: group.name,
    status: group.status,
    confirmedDate: group.confirmedDate,
    confirmedStartTime: group.confirmedStartTime,
    confirmedEndTime: group.confirmedEndTime,
  });
  if (r === "kakao") {
    toast.success("카카오톡 공유 창을 열었어요");
  } else if (r === "clipboard") {
    toast.success("링크가 복사되었어요!");
  } else {
    toast.error("공유에 실패했어요");
  }
}, [group]);
```

- [ ] **Step 3: 버튼 onClick + 토스트 영역 교체**

기존 (303~319행):

```tsx
<button
  onClick={handleCopyLink}
  aria-label="초대 링크 복사"
  className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
>
  {linkCopied ? (
    <Check size={18} className="text-violet-600 dark:text-violet-400" strokeWidth={2} />
  ) : (
    <Link2 size={18} className="text-gray-600 dark:text-gray-400" strokeWidth={1.5} />
  )}
</button>
```

그리고 그 아래(315~319행):

```tsx
{linkCopied && (
  <div className="flex-none mx-5 mt-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-xs text-violet-700 dark:text-violet-300 text-center">
    링크가 복사되었어요!
  </div>
)}
```

두 블록을 다음으로 교체(자체 토스트 div는 제거, sonner Toaster가 layout에서 처리):

```tsx
<button
  onClick={handleShare}
  aria-label="모임 링크 공유"
  className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
>
  <Link2 size={18} className="text-gray-600 dark:text-gray-400" strokeWidth={1.5} />
</button>
```

(주의: 위 교체는 두 블록(`<button>...</button>` + 그 다음의 `{linkCopied && ...}`)을 묶어서 한꺼번에 처리한다. 편집기에서 `<button` 시작부터 `</div>` `)` `}` 닫는 줄까지 한 번에 선택해서 교체.)

- [ ] **Step 4: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. 만약 `Check` import가 다른 곳에서도 쓰이면 lint 통과(unused 없음), 안 쓰이면 위 import 정정에서 이미 제거했으니 통과. `useState` 미사용 경고가 뜨면 GroupDetailClient 다른 곳에서 useState를 쓰는지 확인 — 다른 곳에서 쓰면 그대로 두고, 안 쓰면 import에서 제거.

- [ ] **Step 5: 커밋**

```bash
git add src/app/group/[id]/GroupDetailClient.tsx
git commit -m "feat(group): 공유 버튼 카톡 SDK 호출 + sonner toast + 투표/확정 분기"
```

---

### Task 6: 빌드 검증

- [ ] **Step 1: 전체 typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: 에러 0.

- [ ] **Step 2: 프로덕션 빌드**

```bash
pnpm build
```

Expected: `Compiled successfully`.

---

### Task 7: 푸시 + Vercel CLI 프로덕션 배포

**Prereq (이미 검증됨):**
- 작업 브랜치: master
- `.vercel/project.json` 존재 — 프로젝트가 `skaehdgnl2005-7966s-projects/harness`에 link됨.
- `vercel --version` → 50.32.5.
- `vercel ls` → 직전 production 배포 정상.

- [ ] **Step 1: 푸시**

```bash
git push
```

Expected: master에 푸시 완료.

- [ ] **Step 2: 프로덕션 배포**

```bash
vercel --prod --yes
```

Expected: 배포 URL 출력. `--yes`로 잔여 프롬프트 자동 승인.

- [ ] **Step 3: 배포 상태 확인**

```bash
vercel ls | head -3
```

Expected: 최신 배포가 `● Ready`.

---

## Verification Summary

| 항목 | 방법 | 통과 기준 |
|---|---|---|
| 타입 안정성 | `pnpm typecheck` | 에러 0 |
| 린트 | `pnpm lint` | 에러 0 |
| 빌드 | `pnpm build` | 성공 |
| SDK 로드 | 배포 URL → DevTools Network에서 `kakao_js_sdk` 로드 확인 | 200 OK |
| voting 분기 | 호스트로 voting 모임 진입 → 공유 버튼 → SDK 카드 미리보기 | `투표가 도착했어요` |
| 확정 분기 | 호스트로 confirmed 모임 진입 → 공유 버튼 → SDK 카드 미리보기 | `일정이 확정됐어요` + 시간 |
| SDK init 안 됨 폴백 | `Kakao.isInitialized() === false`인 시나리오 | 클립보드 + `링크가 복사되었어요!` toast |
| 프로덕션 배포 | `vercel --prod --yes` | URL 출력 + `Ready` |

**사용자 확인 항목 (코드 외):**

- Kakao Developers 콘솔에서 JavaScript 키의 "Web 플랫폼" 도메인 등록에 `harness-mu.vercel.app`(또는 사용 중인 프로덕션 도메인)이 포함되어 있는지 확인. 미등록 시 SDK 호출은 silent fail → 클립보드 폴백.

---

## Out of Scope

- 친구 추가 카톡 공유 텍스트 변경 — `shareInviteLink`는 그대로. 단 SDK init 추가의 부수효과로 친구 추가 화면도 본 변경 이후 SDK 카드 미리보기가 정상 동작하게 됨.
- OG metadata 카피 변경 — 이미 분기 적용됨 (`/g/[code]/page.tsx`의 `generateMetadata`).
- 카카오 SDK Share 템플릿 ID 등록 — 현재 `objectType: "feed"`로 즉석 카드 사용 중.
- 게스트 페이지(`/g/[code]`)에서의 공유 — 게스트가 다른 친구에게 같은 모임을 권하는 시나리오는 본 변경 대상 아님.
- Kakao Developers 콘솔 도메인 등록 자동화 — 콘솔 작업은 사용자 책임.
