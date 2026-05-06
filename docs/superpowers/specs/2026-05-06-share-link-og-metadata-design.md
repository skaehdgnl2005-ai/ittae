# Share Link OG Metadata — Design

작성일: 2026-05-06
상태: 설계 → 구현 단계로 진입

## 1. Problem

`/i/[code]` (친구 추가 초대), `/g/[code]` (모임 투표 초대) 두 공유 링크 모두 카톡/슬랙/iMessage에 붙여 넣었을 때 동일한 미리보기가 떠요:

> 된다 — 모임 일정 앱
> 친구들과 일정을 맞추고 장소를 고르는 소셜 스케줄링 앱

이건 [src/app/layout.tsx](src/app/layout.tsx)의 전역 metadata 하나만 정의돼 있고, 두 경로에 자체 metadata가 없어서 그래요. 받는 사람 입장에서 이 링크가 "친구 추가"인지 "모임 시간 투표"인지 알 수 없으니, 클릭률·전환율이 떨어져요.

## 2. Decisions

| 항목 | 결정 |
|---|---|
| 미리보기 차별화 방식 | Next.js App Router `generateMetadata` 동적 생성 |
| 개인화 수준 | DB 조회로 닉네임/모임명 노출 (B안) |
| 친구 초대 카피 톤 | 호스트 시점 (A안) |
| 모임 투표 카피 톤 | 호스트 시점 (A안) |
| 모임 확정 상태 카피 | 투표 종료 표시만 (B안) — 확정 정보(날짜/시간) 노출 안 함 |
| OG 이미지 | 추가 안 함 (텍스트만) |

## 3. Copy Spec

### 친구 초대 — `/i/[code]`

- title: `{nickname}님이 친구 추가 요청을 보냈어요`
- description: `된다에서 함께 모임을 잡아봐요`
- 유효하지 않은 code → 빈 객체 반환 → root layout 폴백
- nickname이 빈 문자열/null인 경우 → "친구"로 폴백

### 모임 투표 — `/g/[code]`

투표 중 (`status === "voting"`):
- title: `{group.name} 투표가 도착했어요`
- description: `가능한 시간을 골라주세요`

그 외 상태 (confirmed/cancelled 등):
- title: `{group.name} — 투표가 종료됐어요`
- description: `탭해서 확정된 일정 보기`

유효하지 않은 code → 빈 객체 반환 → root layout 폴백

## 4. Architecture

### 4.1 친구 초대 페이지

`src/app/i/[code]/page.tsx`에 `generateMetadata` 추가. 기존 헬퍼 `getInviteUserByCode(code)`(`src/app/friends/actions.ts`에 정의)를 그대로 재사용. metadata 생성과 페이지 렌더 양쪽에서 같은 헬퍼 호출 → Next.js의 동일 요청 dedupe 메커니즘은 신뢰하지 않고, 문서상 한 페이지 라이프사이클에서 두 번 호출돼도 비용 미미하다고 판단.

### 4.2 모임 페이지

현재 `/g/[code]/page.tsx`가 inline으로 `(admin as any).from("groups").select(...).eq("invite_code", code).maybeSingle()`을 사용. metadata에서도 같은 lookup이 필요하니 작은 헬퍼로 추출:

**신규 파일: `src/lib/groups/getGroupByInviteCode.ts`**

```ts
import { createAdminClient } from "@/lib/supabase/admin";

export type GroupByInviteCode = {
  id: string;
  name: string;
  status: string;
  confirmed_date: string | null;
  confirmed_start_time: string | null;
  confirmed_end_time: string | null;
};

export async function getGroupByInviteCode(
  code: string
): Promise<GroupByInviteCode | null> {
  const admin = createAdminClient();
  // confirmed_* 컬럼이 generated types에 없을 수 있어 any 캐스팅 (기존 page.tsx와 동일 처리).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("groups")
    .select("id, name, status, confirmed_date, confirmed_start_time, confirmed_end_time")
    .eq("invite_code", code)
    .maybeSingle();
  return data ?? null;
}
```

이 헬퍼는 page.tsx의 기존 inline 쿼리를 대체하고, `generateMetadata`에서도 호출.

### 4.3 generateMetadata 시그니처

기존 `page.tsx`가 `params: Promise<{ code: string }>` 패턴(`const { code } = await params`)을 사용 중이므로 `generateMetadata`도 동일 시그니처:

```ts
export async function generateMetadata(
  { params }: { params: Promise<{ code: string }> }
): Promise<Metadata> { ... }
```

## 5. Edge Cases

| 케이스 | 동작 |
|---|---|
| code가 invalid (조회 실패) | 빈 객체 `{}` 반환 → root layout의 기본 metadata 적용 |
| nickname이 null/빈 문자열 | "친구"로 폴백 |
| group.name이 비정상적으로 긴 경우 | 그대로 사용 (카톡이 자체적으로 truncate). 별도 처리 X |
| OG 크롤러 user-agent 분기 | 안 함. 어차피 generateMetadata는 SSR 시 항상 실행 |
| 봇 트래픽 추가 DB 쿼리 비용 | 카톡 봇 등은 제한된 빈도. 무시 가능 |

## 6. Verification

- `pnpm typecheck && pnpm lint` 통과
- 로컬 dev 서버에서 `curl http://localhost:3000/i/<유효한코드>` 응답 HTML에 `<title>{nickname}님이 친구 추가 요청을 보냈어요</title>`, `<meta property="og:title" content="...">` 포함 확인
- 같은 방식으로 `/g/<유효한코드>` 확인 (voting / non-voting 둘 다)
- 유효하지 않은 code(`/i/zzzzzz`, `/g/zzzzzzzz`)에 대해 root layout의 기본 title/description으로 폴백되는지 확인
- 배포 후 카톡 디버거(또는 실제 카톡) 미리보기 확인

## 7. Out of Scope

- OG 이미지(고정 또는 동적 `ImageResponse`) — v2에서 검토
- 호스트가 보낸 초대 텍스트 커스터마이즈 — 현재 카톡 기본 미리보기로 충분
- 카톡 SDK Share API 별도 처리 — 현재 클립보드 복사 방식 유지
- A/B 테스트, 분석 — 데모 단계라 불필요
