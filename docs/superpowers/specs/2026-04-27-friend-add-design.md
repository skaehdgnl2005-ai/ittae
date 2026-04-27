# 친구 추가 메커니즘 설계 (2026-04-27)

## 배경

현재 친구 탭은 `friendships.status='accepted'` 행만 읽어 친구 목록을 보여줌. 친구 요청을 **보내는** UI도, 받은 요청을 **수락/거절**하는 UI도 없고, 그것을 받쳐줄 server action·라우트도 없음. 카카오 로그인이 합성 이메일(`kakao_{id}@kakao.local`)을 사용하는 상황이라 이메일 검색은 의미가 없음. 닉네임 또한 카카오 닉네임이 그대로 들어와 동명이인이 흔하다.

## 결정 사항

- **발견 수단**: 닉네임 부분 검색(LIKE) + 사용자별 짧은 초대 링크의 두 축. 상호 보완적.
- **닉네임 모델**: 비유니크 그대로. 동명이인은 프로필 사진 + 상태 메시지로 시각 구분.
- **초대 링크**: `users.invite_code` 컬럼(6자, 혼동글자 제외) + `/i/{code}` 라우트. UUID는 노출하지 않음.
- **거절**: `friendships` 행 삭제(논리상태 추가 없음).
- **보안 경계**: 클라이언트는 다른 사용자 행을 직접 읽지 못함. RLS는 그대로 두고 검색·초대링크 도착 페이지는 server action / 서버 컴포넌트가 admin client로 조회 후 `PublicUser`로 정제해 반환.
- **UI 위치**: 친구 탭 상단에 "받은 친구 요청" 섹션 + 검색바 옆 `+` 버튼 → 바텀시트 모달(검색 + 내 초대 링크).

## 데이터 모델

### `users.invite_code` 추가

```sql
alter table users add column invite_code text;
create unique index users_invite_code_unique_idx
  on users(invite_code) where invite_code is not null;
```

- 알파벳 `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (32자, `0/O/1/I/L` 제외) 중 6자. 32^6 ≈ 10억.
- 생성은 `setupProfile` server action에서. unique 충돌 시 최대 5회 재시도.
- 기존 사용자 백필은 마이그레이션에서 PL/pgSQL DO 블록으로 처리.

### `friendships` 변경 없음 + delete 정책 추가

스키마(`status: 'pending' | 'accepted'`, `unique(requester_id, receiver_id)`)는 그대로. 단, 거절 시 행 삭제가 필요하므로 RLS에 delete 정책 추가:

```sql
create policy "friendships_delete_receiver" on friendships
  for delete using (auth.uid() = receiver_id);
```

기존 정책(`friendships_select_own`, `friendships_insert_requester`, `friendships_update_receiver`)은 그대로.

### 검색 인덱스

`%query%` 형태의 부분 매칭은 일반 인덱스가 도움 안 됨. 시연 규모(수백 행)에서는 sequential scan으로 충분. 추후 행이 늘면 `pg_trgm` GIN 인덱스로 추가. 마이그레이션에 인덱스는 넣지 않음.

## 보안 모델

`users` 테이블 RLS는 손대지 않음(`users_select_self` + `users_select_friends`만). 닉네임 검색·초대 링크 도착 페이지는 다음 두 server action만이 admin client를 통해 다른 사용자 행을 조회하고, 응답은 `PublicUser` 타입(`id, nickname, profileImageUrl, statusMessage`)으로 정제해 반환:

- `searchUsersByNickname(query)` — `nickname ILIKE '%query%'` 매칭, 자기 제외, limit 20.
- `getInviteUserByCode(code)` — `invite_code = ?` 매칭 1행.

이메일·기타 컬럼은 응답 타입에서 제외되므로 컴파일 타임에 노출 차단. admin client 사용처는 위 두 함수(`searchUsersByNickname`, `getInviteUserByCode`) **둘뿐**. 나머지 server action(`sendFriendRequest`, `acceptFriendRequest`, `rejectFriendRequest`)은 일반 `createServerClient()`를 쓰고 friendships RLS 정책(insert는 requester=me, update는 receiver=me, delete는 receiver=me)으로 보호. 이렇게 admin 표면을 좁혀 검토 비용을 낮춤.

## 서버 액션 (`src/app/friends/actions.ts`)

모두 `"use server"`. 응답 타입:

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
```

| 액션 | 시그니처 | 동작 |
|---|---|---|
| 검색 | `searchUsersByNickname(query: string): Promise<Result<UserSearchResult[]>>` | admin client로 LIKE 검색. 결과별 friendships 한 번 조회해 `relationship` 주석. 빈 query → `{ok:true, data:[]}`. |
| 신청 | `sendFriendRequest(targetUserId: string): Promise<Result<void>>` | 자기 자신 차단. 기존 행 분기 처리(아래 표). 없으면 INSERT (me, target, 'pending'). 성공 시 `revalidatePath('/friends')`. |
| 수락 | `acceptFriendRequest(requesterId: string): Promise<Result<void>>` | receiver=me, status='pending' 행 UPDATE → 'accepted'. `revalidatePath('/friends')`. |
| 거절 | `rejectFriendRequest(requesterId: string): Promise<Result<void>>` | 위 조건의 행 DELETE. `revalidatePath('/friends')`. |
| 초대조회 | `getInviteUserByCode(code: string): Promise<PublicUser \| null>` | `/i/[code]` 서버 컴포넌트에서 호출. admin client. |

### `sendFriendRequest` 사전 상태 분기

| 기존 행 상태 | 응답 |
|---|---|
| 같은 방향 `pending` | `{ok:false, error:"이미 신청을 보냈어요"}` |
| 같은 방향 `accepted` | `{ok:false, error:"이미 친구입니다"}` |
| 역방향 `pending` | `{ok:false, error:"받은 요청에서 수락하세요"}` |
| 역방향 `accepted` | `{ok:false, error:"이미 친구입니다"}` |
| 없음 | INSERT 후 `{ok:true}` |

자동 수락(역방향 pending → accepted 합치기)은 의도 명확화를 위해 하지 않음.

### 헬퍼

`src/lib/invite-code.ts`:
```ts
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generateInviteCode(): string {
  // 32^6 random pick
}
```

## 타입 (`src/types/index.ts` 추가)

```ts
export type PublicUser = Pick<User, "id" | "nickname" | "profileImageUrl" | "statusMessage">;

export type RelationshipStatus =
  | "none"
  | "pending_sent"      // 내가 보낸 신청, 상대 응답 대기
  | "pending_received"  // 상대가 보낸 신청, 내 응답 대기
  | "accepted";

export type UserSearchResult = PublicUser & { relationship: RelationshipStatus };

export type PendingFriendRequest = {
  requesterId: string;
  requester: PublicUser;
  createdAt: string;
};
```

`src/lib/mappers.ts`에 `mapPublicUser(row): PublicUser` 추가.

## 라우트·UI

### 페이지

- `src/app/(main)/friends/page.tsx` — 기존 friends·groups에 더해 `PendingFriendRequest[]`도 fetch (RLS상 본인이 receiver인 pending 행만 자연스럽게 보임). `FriendsView`에 prop 추가.
- `src/app/i/[code]/page.tsx` (신규, server) — `getInviteUserByCode(code)`. 결과:
  - `null` → "유효하지 않은 초대 링크"
  - 본인 코드 → "내 초대 링크입니다" 안내
  - 비로그인 → 로그인으로 redirect, 성공 후 같은 경로로 복귀(`?next=/i/{code}`)
  - 그 외 → `<InviteAcceptCard publicUser={...} />`

### 컴포넌트 (모두 200줄 이하)

| 파일 | 역할 |
|---|---|
| `src/components/friends/PendingRequestsSection.tsx` (client) | 받은 요청 카드 리스트, "수락"/"거절" 버튼, 액션 후 `router.refresh()` |
| `src/components/friends/AddFriendSheet.tsx` (client) | shadcn Sheet. 내 초대 링크(복사·카톡 공유) + 닉네임 검색 |
| `src/components/friends/UserSearchResultCard.tsx` (client) | 검색 결과 1행. relationship별 버튼 분기 |
| `src/app/i/[code]/InviteAcceptCard.tsx` (client) | 도착 페이지 카드 + "친구 신청" 버튼 |

### 변경되는 파일

- `src/components/friends/FriendsView.tsx` — `pendingRequests` prop 수용, 친구 탭 본문 상단에 `<PendingRequestsSection>` (배열 빈 경우 렌더 X). 검색바 영역에 `+` IconButton + Sheet 트리거. 200줄 룰 유지를 위해 Sheet 내부는 `AddFriendSheet`로 분리.
- `src/app/profile/setup/actions.ts` — `setupProfile` payload에 invite_code 추가, 충돌 재시도 루프.
- `src/lib/routes.ts` — `INVITE: (code) => \`/i/${code}\``.
- `src/lib/share.ts` (신규 또는 기존 카카오 래퍼에 추가) — `shareInviteLink(code, nickname)`. Kakao SDK Share 사용. SDK init 미완 / 차단 상황에선 클립보드 복사로 폴백(시연 환경에서 동작 보장).

### `UserSearchResultCard` 버튼 매핑

| relationship | 버튼 라벨 | 활성 | 동작 |
|---|---|---|---|
| `none` | "친구 신청" | ✓ | `sendFriendRequest` |
| `pending_sent` | "신청 보냄" | ✗ | — |
| `pending_received` | "받은 요청 있음" | ✗ | 토스트 "친구 탭 상단의 받은 요청에서 수락하세요" |
| `accepted` | "친구" | ✗ | — |

## 마이그레이션

파일: `supabase/migrations/004_friend_add.sql`

1. `users.invite_code` 컬럼 + partial unique index.
2. 기존 사용자 백필 — DO 블록으로 `update users set invite_code = … where invite_code is null` (PL/pgSQL 함수로 6자 생성, 충돌 시 재시도).
3. `friendships_delete_receiver` RLS 정책.
4. 적용 후 `pnpm db:types`.

## 시연 시나리오

두 브라우저(예: Chrome / Chrome 시크릿) = 두 계정 A·B.

### 플로우 A — 초대 링크
1. A: 카카오 로그인 → 프로필 셋업(invite_code 자동 생성) → 홈
2. A: 친구 탭 → `+` → "복사" 또는 "카톡 공유" (시연에선 URL 복사로 대체 가능)
3. B: 두 번째 브라우저에서 `/i/{code}` 진입 → A 공개 카드 + "친구 신청"
4. B: 신청 → 토스트 → 홈
5. A: 친구 탭 새로고침 → 상단 "받은 친구 요청 1" 카드 → "수락"
6. 양쪽 친구 목록에 등장

### 플로우 B — 닉네임 검색
1. B: 친구 탭 → `+` → "닉네임으로 찾기" → A 닉네임 일부 입력 → 결과 카드(프로필 사진·상태로 식별)
2. B: "친구 신청" → A의 수락 흐름은 위와 동일

## 엣지케이스(구현 시 처리)

- 자기 자신 검색 결과 제외(`.neq('id', auth.uid())`).
- 자기 자신 invite 코드 접근 시 "내 초대 링크입니다" 안내.
- 빈 검색어 → 요청 자체 미전송, 결과 비움.
- 검색 결과 limit 20 (`limit(20)`).
- 거절 후 동일인 재신청 — 허용(스팸 방지 X, MVP 우선; 추후 `rejected` 상태 추가 마이그레이션 가능).
- 동시 클릭(double submit) — 버튼 disable 처리.
- `setupProfile` invite_code 5회 재시도 모두 실패 시 — 사실상 발생 안 하지만 에러 반환.

## 완료 조건

- `pnpm typecheck && pnpm lint` 통과.
- 두 계정으로 위 두 플로우 시연 시 끊김 없음 (요청 → 수락 → 친구 목록 갱신).
- 컴포넌트 파일 모두 200줄 이하.
- 모든 server action `Result<T>` 타입 사용.
- admin client는 위 명시한 5개 server action / 1개 서버 컴포넌트 외에서는 사용 안 함.

## 비범위(이번 스펙 밖)

- 친구 차단(block) 기능
- 친구 끊기(unfriend) UI — 행 삭제는 가능하지만 UI 없음
- 푸시 알림 / 실시간 친구 요청 알림
- invite_code 재발급 UI
- 일회용·만료 초대 토큰
- 카카오 친구 가져오기 연동
- 닉네임 유니크화 / handle 시스템
