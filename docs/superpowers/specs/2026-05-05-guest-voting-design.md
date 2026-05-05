# Guest Voting (비회원 모임 투표) — Design

작성일: 2026-05-05
상태: 설계 승인 → 구현 단계로 진입

## 1. Problem

현재 모임 상세 화면 우상단의 "링크 공유" 버튼은 단순히 `window.location.href`(즉 `/group/<UUID>`)를 클립보드에 복사한다. 이 링크를 카톡으로 받은 사람은:

- 비로그인이면 미들웨어가 `/login`으로 리다이렉트
- 로그인했지만 그 모임 멤버가 아니면 `group/[id]/page.tsx` 멤버십 체크에서 `notFound()` → 404

즉 외부 공유가 작동하지 않는다. 데모 시나리오의 "카톡 공유" 단계를 의미 있게 만들려면 **비회원도 링크로 들어와 투표할 수 있어야** 한다.

## 2. Decisions

| 항목 | 결정 |
|---|---|
| 비회원 권한 | 시간/날짜 투표만. 댓글·확정·장소·기록 X |
| 식별 방식 | 닉네임 + 브라우저 localStorage 토큰(UUID) |
| 호스트 화면 | 회원과 동일 취급 + "(게스트)" 뱃지. 매트릭스/카운트 합산 |
| 링크 형식 | `/g/<8자리코드>` 자동 발급 |
| 끄기/만료 | v1 미포함. 모임 status가 `voting`일 때만 새 투표 받음 |

## 3. User Flows

### 호스트
1. 모임 생성 → DB에 `groups.invite_code`가 자동 발급된다.
2. 모임 상세 우상단 링크 버튼을 누르면 `https://<host>/g/<invite_code>` 가 클립보드에 복사된다.
3. 카톡 등으로 링크를 친구에게 보낸다.

### 비회원 친구 (첫 진입)
1. `/g/<code>` 진입.
2. 닉네임 입력 모달이 뜬다 ("민지" 입력).
3. 클라이언트가 새 UUID(게스트 토큰)를 만들어 localStorage(`guest-token:<groupId>`)에 저장한다.
4. 서버에 `POST /api/invite/<code>/guests {nickname, browserToken}` → `group_guests` 행 생성.
5. 게스트 투표 화면 진입. 시간/날짜 투표 → API에 토큰 헤더(`x-guest-token`)로 전달.

### 비회원 재진입 (같은 폰)
1. `/g/<code>` 진입.
2. localStorage에서 토큰 복원. 서버에 `GET /api/invite/<code>/state` → 본인 게스트 + votes/time_slots 포함 응답.
3. 닉네임 모달 없이 바로 진입, 본인 투표 그대로 표시·수정 가능.

### 회원이 게스트 링크 진입
- **이미 그 모임 멤버:** `/group/<id>`로 즉시 리다이렉트(기존 회원 흐름).
- **회원이지만 그 모임 비-멤버:** v1은 게스트로 처리. 진입 페이지에 "게스트로 투표하기" 안내 후 닉네임 입력. (v1.5에서 자동 멤버 가입 옵션 검토.)

### 모임 confirmed/completed 후 게스트 진입
- 진입 페이지가 read-only 결과 화면을 보여준다(투표 입력 X). "일정이 확정됐어요 — <날짜> <시간>".

## 4. Data Model (마이그레이션 008)

```sql
-- 모임당 1개의 초대 코드. 모임 생성 시 자동 발급.
-- 형식: 8자 base32-like (URL-safe, 대문자/숫자, 시각적 모호 문자 0/O/1/I 제외).
-- 충돌 가능성: 32^8 ≈ 1조. 실제 발급은 server-side에서 collision-retry.
alter table groups add column invite_code text unique;

-- 기존 모든 모임에도 코드를 채운다. server-side 마이그레이션 스크립트로 모임마다
-- 8자 코드를 발급하고 unique 제약 충돌 시 재시도. (raw SQL 한 줄로는 충돌 안전하지 않으므로
-- migrations/008 SQL은 컬럼 추가만 하고, 백필은 Node 스크립트 또는 트리거에서 처리.)

-- 게스트 등록부 (모임별)
create table group_guests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade not null,
  nickname text not null,
  browser_token text not null,
  created_at timestamptz default now(),
  unique(group_id, browser_token)
);

alter table group_guests enable row level security;

-- SELECT: 그룹 멤버는 그 그룹의 게스트를 조회 가능.
create policy "group_guests_select_member" on group_guests
  for select using (
    group_id in (select group_id from group_members where user_id = auth.uid())
  );
-- INSERT/UPDATE/DELETE는 service role(server API)에서만 처리 → anon/auth 정책 없음.

-- votes에 guest_id 추가 (XOR with user_id)
alter table votes add column guest_id uuid references group_guests(id) on delete cascade;
alter table votes alter column user_id drop not null;
alter table votes add constraint votes_voter_xor check (
  (user_id is not null) <> (guest_id is not null)
);

-- 기존 unique(session_id, user_id, date)를 partial unique index로 분리
alter table votes drop constraint votes_session_id_user_id_date_key;
create unique index votes_member_unique on votes(session_id, user_id, date)
  where user_id is not null;
create unique index votes_guest_unique on votes(session_id, guest_id, date)
  where guest_id is not null;

-- time_slots에도 동일 처리
alter table time_slots add column guest_id uuid references group_guests(id) on delete cascade;
alter table time_slots alter column user_id drop not null;
alter table time_slots add constraint time_slots_voter_xor check (
  (user_id is not null) <> (guest_id is not null)
);

-- group_guests를 realtime publication에 추가
alter publication supabase_realtime add table group_guests;
```

기존 votes/time_slots SELECT RLS는 무변경. session_id 기반 멤버십 체크라 게스트 행도 자연스럽게 그룹 멤버에게 보인다.

## 5. API

모든 신규 API는 server-side에서 service-role(admin) client로 처리. anon RLS는 풀지 않는다 (기존 `group/[id]/page.tsx`가 admin client로 RLS 우회하는 패턴과 일치).

| 메서드 + 경로 | 동작 | 인증 |
|---|---|---|
| GET `/api/invite/[code]` | 코드 유효성 검증 + group meta(name, status) 응답 | 없음 (anon OK) |
| POST `/api/invite/[code]/guests` | 게스트 등록. body `{nickname, browserToken}`. 응답 `{guestId, nickname}`. 토큰 충돌 시 기존 행 반환 | 없음 |
| GET `/api/invite/[code]/state` | 게스트 시점에서 보는 그룹+세션+votes+time_slots+members+guests 합본. 헤더 `x-guest-token` 필수. | 게스트 토큰 |
| POST/PATCH `/api/invite/[code]/votes` | 게스트 투표 저장. body `{date, choice}`. | 게스트 토큰 |
| PUT `/api/invite/[code]/time-slots` | 게스트 시간 슬롯 저장. body `{date, slots:[{startTime, endTime}]}`. | 게스트 토큰 |

신규 헬퍼: `requireGuest(req, code)` — 헤더 토큰 + code 조합으로 group_guests에서 행 찾기, 없으면 401, 있으면 `{guestId, groupId, sessionId}` 반환.

기존 회원용 API/RLS 변경 없음.

## 6. UI 변경

### 신규 파일
- `src/app/g/[code]/page.tsx` — 서버 컴포넌트. 코드로 group lookup, 회원이면서 멤버면 `/group/<id>`로 redirect, 모임 confirmed면 read-only 결과 표시, 그 외에는 GuestVoteClient 렌더.
- `src/app/g/[code]/GuestVoteClient.tsx` — 클라이언트. 닉네임 모달 → 게스트 등록 → 투표 매트릭스. GroupDetailClient의 read-only 변형.
- `src/components/vote/GuestNicknameModal.tsx` — 닉네임 입력 모달.
- `src/lib/guest.ts` — localStorage 헬퍼: `getGuestToken(groupId)`, `setGuestToken(groupId, token)`, `useGuestSession(code)`.
- `src/lib/api/guest.ts` — fetch 래퍼: 헤더에 `x-guest-token` 자동 첨부.
- `src/app/api/invite/[code]/route.ts`
- `src/app/api/invite/[code]/guests/route.ts`
- `src/app/api/invite/[code]/state/route.ts`
- `src/app/api/invite/[code]/votes/route.ts`
- `src/app/api/invite/[code]/time-slots/route.ts`

### 수정
- `middleware.ts` — `PUBLIC_PATHS`에 `/g/`, `/api/invite/` 접두사 추가.
- `src/app/group/[id]/GroupDetailClient.tsx` — `handleCopyLink`가 `${origin}/g/${invite_code}` 복사. `Group` prop에 `inviteCode` 추가.
- `src/app/group/[id]/page.tsx` — `group_guests` fetch 후 `members` 배열에 합쳐 전달. votes/time_slots에 guest 응답 합산.
- `src/lib/mappers.ts` / `src/types/index.ts` — `Guest` 타입 추가, `Member = (User & {kind:"member"}) | (Guest & {kind:"guest"})`. `Vote`/`TimeSlot`에 `guestId?: string` 추가.
- `src/components/vote/CommentSection.tsx` — 게스트는 댓글 비활성. 변경 최소.
- 멤버 표시 UI(아바타/이름) — 게스트는 닉네임 첫 글자 + 회색 톤 + "(게스트)" 뱃지.
- `src/lib/routes.ts` — `INVITE_GROUP(code)` 추가.
- `src/app/api/groups/route.ts` — POST에서 `invite_code` 자동 발급(8자리 base32 등).

## 7. Realtime

`useVoteRealtime`은 이미 `votes`/`time_slots`를 session_id로 구독 중. 게스트 투표가 같은 테이블에 들어가므로 호스트 화면에 자동 반영된다. `group_guests` 추가도 새 멤버 카운트 반영을 위해 publication에 추가하고, `useVoteRealtime`(또는 별도 훅)에서 `group_guests` INSERT 이벤트를 처리한다.

## 8. 보안 / 엣지

- **닉네임 충돌:** 동일 그룹에 "민지" 둘 가능. 토큰으로 구분되며 데이터 일관성에는 문제 없음. UI는 자동 suffix("민지·1", "민지·2")로 표시.
- **로컬스토리지 도용:** 토큰 가진 사람은 그 게스트 흉내 가능. 데모 MVP 범위 밖.
- **invite_code 추측:** 8자 base32 변형(약 40bit, ≈1조 조합)이면 데모 범위에서 무차별 시도에 충분. 시각적 모호 문자(0/O/1/I) 제외.
- **잘못된 코드:** GET `/api/invite/[code]`에서 404, 클라이언트는 진입 페이지에서 "유효하지 않은 링크"로 표시.
- **모임 종료 후 진입:** confirmed/completed면 진입 페이지가 read-only 결과 표시, POST/PATCH/PUT 게스트 투표 API는 "모임이 마감되었어요" 409 응답.

## 9. v1 범위 외 (v1.5 이후)

- 호스트의 "외부 공유 끄기" 토글
- 회원이 비-멤버 상태로 게스트 링크 진입 시 자동 멤버 가입
- 호스트의 게스트 강제 제거
- invite_code 만료/재발급 UI
- 게스트가 카카오 로그인으로 회원 전환 (게스트 투표를 회원 투표로 이전)
- 게스트 투표를 호스트가 무시할 수 있는 가중치 조절

## 10. Test Plan

- 마이그레이션 008 dry-run + 기존 votes/time_slots에 영향 없음(회원 투표 정상)
- 신규 모임 생성 시 invite_code가 채워져 있는지
- 호스트 우상단 링크 복사 → 시크릿 모드에서 진입 → 닉네임 입력 → 투표 → 호스트 화면 실시간 반영
- 같은 폰 재진입 시 닉네임 모달 안 뜨고 본인 투표 표시
- 다른 폰 재진입 시 다른 게스트로 잡힘 (토큰 분리)
- 모임 confirmed 후 게스트 진입 시 read-only
- 잘못된 코드 진입 시 404
- 회원이면서 그 모임 멤버인 사용자가 `/g/<code>` 진입 → `/group/<id>` 리다이렉트
- typecheck + lint 통과
