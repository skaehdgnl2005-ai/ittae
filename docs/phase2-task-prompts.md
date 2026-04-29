# Phase 2 Task별 인수인계 프롬프트

각 세션 시작 시 해당 Task 프롬프트를 복붙. Task 완료 후 다음 세션으로.

---

## 공통 컨텍스트 (모든 Task에 적용)

- 브랜치: `feature/phase2-backend`
- 작업 경로: `c:/Users/skaeh/Downloads/moim-harness/harness/.worktrees/phase2`
- 프로젝트: Next.js 14 App Router + TypeScript + Tailwind + Supabase + Framer Motion
- 규칙: `any` 타입 금지 / 인라인 스타일 금지 / 서버 컴포넌트 기본 / 컴포넌트 200줄 초과 금지
- 완료 기준: `pnpm typecheck && pnpm lint` 통과 + git commit

---

## Task 1 — 인증

```
TASKS.md 읽고 Phase 2 Task 1 (인증) 만 진행해.

## 현재 상태 (완료된 것)
- Task 0 완료 (커밋: 1fda0991)
- src/lib/supabase/server.ts + client.ts 존재
- src/types/supabase.ts (Database 타입, 9개 테이블) 존재
- @supabase/supabase-js + @supabase/ssr 설치됨

## 작업 경로
c:/Users/skaeh/Downloads/moim-harness/harness/.worktrees/phase2
(브랜치: feature/phase2-backend)

## Task 1 구현 범위
1. src/app/auth/callback/route.ts
   - Supabase OAuth 콜백 Route Handler
   - code 파라미터로 세션 교환 후 /로 리다이렉트

2. src/app/login/page.tsx
   - Google 로그인 버튼 + Kakao 로그인 버튼
   - signInWithOAuth({ provider: 'google' | 'kakao' }) 사용
   - 디자인: 흰 배경, violet-600 버튼, Pretendard 폰트
   - 금지: 그라데이션, 글래스모피즘

3. src/app/profile/setup/page.tsx
   - 닉네임(필수), 프로필 이미지 URL(선택), 상태 메시지(선택) 입력 폼
   - 제출 시 users 테이블 upsert (createBrowserClient 사용)
   - 완료 후 /로 리다이렉트

4. middleware.ts (프로젝트 루트)
   - @supabase/ssr의 createServerClient 사용
   - 비인증 사용자 → /login 리다이렉트
   - /login, /auth/callback 경로는 공개 허용
   - matcher: '/((?!_next/static|_next/image|favicon.ico).*)'

## 완료 조건
- pnpm typecheck && pnpm lint 통과
- git commit 후 멈출 것 (Task 2는 다음 세션)
```

---

## Task 2 — 홈 백엔드

```
TASKS.md 읽고 Phase 2 Task 2 (홈 백엔드) 만 진행해.

## 현재 상태 (완료된 것)
- Task 0: Supabase 헬퍼, DB 타입, migration SQL
- Task 1: 인증 (login page, middleware, auth callback)

## 작업 경로
c:/Users/skaeh/Downloads/moim-harness/harness/.worktrees/phase2
(브랜치: feature/phase2-backend)

## Task 2 구현 범위

### Route Handlers
1. src/app/api/schedules/route.ts
   - GET: 현재 사용자의 schedules 조회 (월 범위 필터: ?year=&month=)
   - POST: 새 schedule 생성
   - createServerClient() 사용, RLS로 자동 사용자 필터

2. src/app/api/schedules/[id]/route.ts
   - PATCH: schedule 수정
   - DELETE: schedule 삭제

### 홈 페이지 실데이터 교체
3. src/app/(main)/home/page.tsx
   - 현재: mockSchedules, mockGroups (목업)
   - 교체: 서버 컴포넌트로 전환, createServerClient()로 schedules + groups 조회
   - 날짜 선택 인터랙션은 클라이언트 상태 유지 (날짜 선택 부분만 "use client")
   - 필요 시 src/components/calendar/ 컴포넌트를 서버/클라이언트로 분리

### 타입 변환 참고
- DB: snake_case (start_time, end_time, user_id)
- 앱: camelCase (startTime, endTime, userId)
- schedules.type 컬럼은 DB에 없음 → group_id가 있으면 "group", 없으면 "personal"로 앱 레벨 계산

## 완료 조건
- pnpm typecheck && pnpm lint 통과
- git commit 후 멈출 것 (Task 3는 다음 세션)
```

---

## Task 3 — 친구/그룹 백엔드

```
TASKS.md 읽고 Phase 2 Task 3 (친구/그룹 백엔드) 만 진행해.

## 현재 상태 (완료된 것)
- Task 0: Supabase 헬퍼, DB 타입, migration SQL
- Task 1: 인증 (login page, middleware, auth callback)
- Task 2: schedules Route Handler, 홈 페이지 실데이터 교체

## 작업 경로
c:/Users/skaeh/Downloads/moim-harness/harness/.worktrees/phase2
(브랜치: feature/phase2-backend)

## Task 3 구현 범위

### Route Handlers
1. src/app/api/friends/route.ts
   - GET: 현재 사용자의 accepted 친구 목록 조회
   - POST: 친구 요청 전송 (friendships INSERT, status='pending')

2. src/app/api/friends/[id]/route.ts
   - PATCH: 친구 요청 수락/거절 (status → 'accepted' 또는 행 DELETE)

3. src/app/api/groups/route.ts
   - GET: 현재 사용자가 속한 groups 목록 (group_members join)
   - POST: 새 그룹 생성 (groups INSERT + 본인 group_members INSERT)

4. src/app/api/groups/[id]/route.ts
   - GET: 특정 그룹 상세 (members 포함)
   - PATCH: 그룹 수정 (이름, status, confirmed_date)

### 친구/그룹 페이지 실데이터 교체
5. src/app/(main)/friends/page.tsx
   - 현재: mockUsers, mockGroups, mockCurrentUserId (목업)
   - 교체: /api/friends + /api/groups 호출
   - 현재 사용자 식별: createBrowserClient()의 getUser()

## 완료 조건
- pnpm typecheck && pnpm lint 통과
- git commit 후 멈출 것 (Task 4는 다음 세션)
```

---

## Task 4 — 투표 백엔드 + Realtime

```
TASKS.md 읽고 Phase 2 Task 4 (투표 백엔드 + Realtime) 만 진행해.

## 현재 상태 (완료된 것)
- Task 0: Supabase 헬퍼, DB 타입, migration SQL
- Task 1: 인증
- Task 2: 홈 백엔드
- Task 3: 친구/그룹 백엔드

## 작업 경로
c:/Users/skaeh/Downloads/moim-harness/harness/.worktrees/phase2
(브랜치: feature/phase2-backend)

## Task 4 구현 범위

### Route Handlers
1. src/app/api/vote-sessions/route.ts
   - POST: 새 vote_session 생성 (candidate_dates, deadline)

2. src/app/api/vote-sessions/[id]/votes/route.ts
   - GET: 해당 session의 전체 votes 조회
   - POST: 투표 제출 (INSERT)
   - PATCH: 기존 투표 수정 (UPDATE)

3. src/app/api/groups/[id]/confirm/route.ts
   - POST: 방장만 호출 가능, groups.status → 'confirmed', confirmed_date 설정

### Realtime 훅
4. src/hooks/useVoteRealtime.ts
   - createBrowserClient() 사용
   - votes 테이블 구독: filter `session_id=eq.${sessionId}`
   - INSERT/UPDATE/DELETE 이벤트별 상태 업데이트 처리
   - useEffect cleanup에서 supabase.removeChannel()

### 투표 페이지 실데이터 교체
5. src/app/group/[id]/page.tsx
   - 현재: mockGroups, mockVoteSession, mockVotes, mockCurrentUserId (목업)
   - 교체: 서버에서 group + voteSession + 초기 votes 조회
   - 클라이언트: useVoteRealtime 훅으로 실시간 갱신
   - 투표 제출: PATCH /api/vote-sessions/[id]/votes
   - 확정: POST /api/groups/[id]/confirm

### Realtime 구독 패턴 (supabase.md 규칙)
- channel 이름: `votes:${sessionId}`
- useEffect return에서 반드시 unsubscribe
- cleanup: supabase.removeChannel(channel)

## 완료 조건
- pnpm typecheck && pnpm lint 통과
- git commit 후 멈출 것 (Task 5는 다음 세션)
```

---

## Task 5 — 지도 백엔드

```
TASKS.md 읽고 Phase 2 Task 5 (지도 백엔드) 만 진행해.

## 현재 상태 (완료된 것)
- Task 0: Supabase 헬퍼, DB 타입, migration SQL
- Task 1: 인증
- Task 2: 홈 백엔드
- Task 3: 친구/그룹 백엔드
- Task 4: 투표 백엔드 + Realtime

## 작업 경로
c:/Users/skaeh/Downloads/moim-harness/harness/.worktrees/phase2
(브랜치: feature/phase2-backend)

## Task 5 구현 범위

### Route Handlers
1. src/app/api/places/search/route.ts
   - GET: Kakao Local API 키워드 검색 래퍼
   - 쿼리 파라미터: ?query=&category_group_code=&x=&y=&radius=
   - 서버에서 Kakao REST API 호출 (KAKAO_REST_API_KEY 환경 변수 사용)
   - 응답: Place[] 형태로 변환 (카카오 응답 → 앱 타입)
   - 결과: 거리순, 최대 15개

2. src/app/api/places/route.ts
   - POST: 선택한 장소를 places 테이블에 저장
   - 중복 방지: kakao_place_id 또는 (name + address)로 upsert

### 지도 페이지 실데이터 교체
3. src/app/(main)/map/page.tsx
   - 현재: mockPlaces (목업)
   - 교체: CategoryFilterBar 선택 시 /api/places/search 호출
   - 현재 위치 또는 기본 좌표(서울 중심) 기준 검색
   - 장소 선택 시 /api/places POST로 저장

### KakaoTalk 공유
4. src/components/map/KakaoShareButton.tsx (신규)
   - window.Kakao.Share.sendDefault() 사용
   - 공유 내용: 장소명, 주소, 지도 링크
   - KakaoMapProvider 내부에서만 렌더링

### 환경 변수 (코드 내 참조만, .env.local 커밋 금지)
- KAKAO_REST_API_KEY — Kakao Local API 서버 호출용 (NEXT_PUBLIC_ 아님)
- NEXT_PUBLIC_KAKAO_JS_KEY — 기존 Maps SDK용

## 완료 조건
- pnpm typecheck && pnpm lint 통과
- git commit 후 멈출 것 (Task 6는 다음 세션)
```

---

## Task 6 — 기록 백엔드

```
TASKS.md 읽고 Phase 2 Task 6 (기록 백엔드) 만 진행해.

## 현재 상태 (완료된 것)
- Task 0: Supabase 헬퍼, DB 타입, migration SQL
- Task 1: 인증
- Task 2: 홈 백엔드
- Task 3: 친구/그룹 백엔드
- Task 4: 투표 백엔드 + Realtime
- Task 5: 지도 백엔드

## 작업 경로
c:/Users/skaeh/Downloads/moim-harness/harness/.worktrees/phase2
(브랜치: feature/phase2-backend)

## Task 6 구현 범위

### Route Handlers
1. src/app/api/memories/route.ts
   - GET: 현재 사용자가 속한 그룹의 memories 조회 (최신순, participants 포함)
   - POST: 새 memory 생성 (date, group_id, place_id, note)

2. src/app/api/memories/[id]/route.ts
   - PATCH: memory 수정 (note 등)
   - DELETE: memory 삭제 (그룹 멤버만 가능, RLS 적용)

3. src/app/api/memories/upload/route.ts
   - POST: multipart/form-data 사진 업로드
   - Supabase Storage 버킷: 'memory-photos'
   - 경로: {userId}/{memoryId}/{filename}
   - 최대 5장 제한 (서버에서 검증)
   - 반환: 업로드된 파일의 public URL

### 기록 페이지 실데이터 교체
4. src/app/(main)/history/page.tsx
   - 현재: mockMemories, mockPlaces (목업) — 서버 컴포넌트
   - 교체: createServerClient()로 memories + places 조회
   - StatsSummary, TimelineView에 실데이터 전달

### 타입 변환 참고
- memories.photos: string[] (Supabase Storage public URL 배열)
- participants: group_members join → User[]

## 최종 완료 조건
- pnpm typecheck && pnpm lint 통과
- git commit
- Phase 2 전체 완료 → superpowers:finishing-a-development-branch 스킬로 PR 생성
```

---

## 진행 순서 요약

| Task | 내용 | 완료 커밋 |
|------|------|-----------|
| Task 0 | Supabase 설정 | 1fda0991 ✅ |
| Task 1 | 인증 | - |
| Task 2 | 홈 백엔드 | - |
| Task 3 | 친구/그룹 백엔드 | - |
| Task 4 | 투표 + Realtime | - |
| Task 5 | 지도 백엔드 | - |
| Task 6 | 기록 백엔드 | - |
