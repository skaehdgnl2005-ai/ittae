# TASKS.md — Ittae MVP 개발 트래커

> 새 세션 시작 시 이 파일을 가장 먼저 읽을 것. 현재 상태와 다음 작업이 여기에 있다.

---

## 현재 상태

| 항목 | 상태 |
|------|------|
| **현재 Phase** | Phase 2 — 백엔드 연결 진행 중 |
| **Next Action** | Task 2 (홈 백엔드) 부터 `superpowers:subagent-driven-development` 스킬로 계속 |
| **작업 브랜치** | `feature/phase2-backend` (`.worktrees/phase2/` 워크트리) |
| **Phase 1** | ✅ 완료 — 5개 화면 모두 목업 데이터 기반 구현 완료 |
| **Phase 2 Task 0** | ✅ 완료 — Supabase 설정, DB 타입, 마이그레이션, HANDOFF.md |
| **Phase 2 Task 1** | ✅ 완료 — Auth, 로그인 UI, 프로필 설정, middleware |
| **Phase 2 Task 2~6** | ⏳ 대기 중 |
| **인수인계 문서** | `docs/HANDOFF.md` ✅ |

### Phase 2 워크트리 정보
- **경로**: `.worktrees/phase2/` (gitignore됨)
- **브랜치**: `feature/phase2-backend`
- **완료 커밋**: `a6ad052e` (Task 1 인증 완성)
- **새 파일들**: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/types/supabase.ts`, `supabase/migrations/001_initial_schema.sql`, `docs/HANDOFF.md`

### Phase 2 시작 전 필요한 환경 설정 (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
KAKAO_REST_API_KEY=your-kakao-rest-key
NEXT_PUBLIC_KAKAO_JS_KEY=your-kakao-js-key
```

### 확정된 기술 결정 (변경 불가)
- 실행 순서: TASKS.md 그대로 (Phase 0→1→2→3→4→5)
- 캘린더: date-fns 기반 직접 구현 (shadcn/ui Calendar 미사용)
- 목업 인터랙션: React useState
- 애니메이션: Framer Motion — 페이지 fade+translateY(8px), 리스트 50ms stagger

---

## Phase 1: 프론트엔드 + 디자인

> **전체 일정의 60% 이상 투자.** 심사위원이 직접 보고 만지는 영역이 제품의 인상을 결정한다.
> 규칙: 각 화면 완료 시 `/design-check` 반드시 실행. 통과 전까지 다음 화면 진행 금지.

### 0. 프로젝트 초기화 및 공통 기반

- [ ] Next.js 14 App Router 프로젝트 생성 (`pnpm create next-app`)
- [ ] Tailwind CSS 커스텀 팔레트 설정 (`violet-*`, `gray-*` — DESIGN_SYSTEM.md 참고)
- [ ] Pretendard Variable + Instrument Serif 폰트 설정 (`next/font/local`)
- [ ] shadcn/ui 초기화 + 필요 컴포넌트 설치
- [ ] `src/lib/utils.ts` — `cn()` 유틸리티
- [ ] Bottom tab navigation 레이아웃 (`src/app/(main)/layout.tsx`, 5탭: home/friends/create/map/history)
- [ ] 공통 컴포넌트: `Avatar`, `Badge`, `Card`, `Button` (DESIGN_SYSTEM.md 스펙 준수)
- [ ] 목업 데이터 파일 (`src/lib/mock/index.ts`) — users, groups, votes, places, memories

### 1. 홈 — 캘린더 대시보드

기능 ID: H-01 ~ H-06

- [ ] `MonthlyCalendar` — Instrument Serif 날짜 숫자, 오늘 violet-600 원, 이벤트 dot
- [ ] `DayEventList` — 시간·장소·참여자, 좌측 3px 컬러바 (gray=개인, violet=그룹)
- [ ] `TodaySummaryCard` — 오늘 일정 요약 카드
- [ ] 날짜 선택 인터랙션 (선택 시 DayEventList 업데이트)
- [ ] 빈 상태(empty state) — 텍스트만 + CTA 버튼
- [ ] 목업 데이터 연결
- [ ] **`/design-check src/app/(main)/home/` 실행 및 통과 확인**

### 2. 친구 / 그룹 목록

기능 ID: F-01 ~ F-07

- [ ] `FriendList` — 검색바(gray-100 bg, violet-600 focus), 32px 아바타, 이름·최근날짜
- [ ] `GroupCard` — 상태 배지(voting/confirmed/completed), 아바타 그룹(최대 4+N), 날짜
- [ ] `FilterChip` — 전체/투표중/확정/완료 (선택 = violet-50 bg + violet-600 text)
- [ ] 친구 요청 상태 표시 (pending 배지)
- [ ] 목업 데이터 연결
- [ ] **`/design-check src/app/(main)/friends/` 실행 및 통과 확인**

### 3. 그룹 상세 — 투표

기능 ID: V-01 ~ V-08 | `/vote-flow` 스킬 사용

- [ ] `VoteMatrix` — 날짜 × 참여자 그리드, 셀 44px (터치 타겟)
- [ ] `VoteCell` — ⭕ violet-500 / △ amber-400 / ❌ gray-300, 최적 날짜 행 violet-50 bg
- [ ] `BestDateBanner` — 자동 추천 날짜 표시
- [ ] `StickyConfirmButton` — 하단 고정, 전원 투표 전 disabled
- [ ] `CommentSection` — 투표 댓글
- [ ] 목업 데이터 연결
- [ ] **`/design-check src/app/group/[id]/` 실행 및 통과 확인**

### 4. 지도 — 장소 선택

기능 ID: M-01 ~ M-08

- [ ] `KakaoMapProvider` — `next/script` afterInteractive 전략, window.kakao 로딩 확인
- [ ] `MapView` — 100% 너비, 고정 높이, 마커 (violet-600 선택 / gray-400 미선택)
- [ ] `RadiusOverlay` — 반투명 violet-100 fill + violet-300 stroke 원
- [ ] `RadiusSlider` — 500m~5km, 하단 시트 내
- [ ] `CategoryFilterBar` — 음식점(FD6)/카페(CE7)/지하철(SW8) 필터
- [ ] `PlaceCard` — 이름·평점·사진·거리
- [ ] `PlaceCardCarousel` — 지도 위 가로 스크롤 카드
- [ ] 목업 데이터 연결 (실제 Kakao API 연동은 Phase 2)
- [ ] **`/design-check src/app/(main)/map/` 실행 및 통과 확인**

### 5. 기록 — 히스토리

기능 ID: R-01 ~ R-07

- [ ] `TimelineView` — 좌측 수직선(gray-200) + 카드 목록 (최신순)
- [ ] `MemoryCard` — 날짜·장소·참여자·대표 사진 (12px radius)
- [ ] `StatsSummary` — "총 23번의 모임" — Instrument Serif Display 숫자
- [ ] `MapMemoryView` — 방문 장소 핀 표시 (지도/리스트 토글)
- [ ] 날짜/월 필터
- [ ] 목업 데이터 연결
- [ ] **`/design-check src/app/(main)/history/` 실행 및 통과 확인**

### Phase 1 완료 기준

- [ ] 5개 화면 모두 `/design-check` 통과 (위 체크리스트 전부 완료)
- [ ] `pnpm typecheck && pnpm lint` 클린
- [ ] 데모 플로우 끊김 없이 동작: 홈 → 친구 → 그룹 생성 → 투표 → 지도 → 기록
- [ ] **`docs/HANDOFF.md` 작성 완료** (Phase 2 진입 전 필수)

---

## Phase 1 → Phase 2 인수인계

Phase 1 완료 후, Phase 2 진입 전에 `docs/HANDOFF.md`를 생성한다.
포함 내용:

- 각 화면이 현재 소비하는 목업 데이터 구조 (타입 명시)
- 화면별 예상 API 엔드포인트 및 요청/응답 형태
- 목업 → 실데이터 교체 시 수정이 필요한 파일 목록
- Supabase Realtime이 필요한 구독 포인트 (투표 실시간 업데이트 등)

---

## Phase 2: 백엔드 연결

> Phase 1 완료 + `docs/HANDOFF.md` 작성 후 시작.
> 목표: 목업 데이터를 실제 Supabase 데이터로 교체.

### 0. Supabase 설정 ✅ 완료

- [ ] Supabase 프로젝트 생성, `.env.local` 환경 변수 설정 ← **사람이 직접 설정 필요**
- [x] `supabase/migrations/001_initial_schema.sql` — DATA_MODEL.md 전체 스키마 적용
- [x] RLS 정책 전체 적용 (`rls-check.sh` 포함)
- [x] `src/types/supabase.ts` — DATA_MODEL.md 기반 수동 작성 (`pnpm db:types`는 실제 Supabase 연결 후 재생성)
- [x] `src/lib/supabase/server.ts` + `src/lib/supabase/client.ts` 헬퍼 구현

### 1. 인증 ✅ 완료 — 커밋 `a6ad052e`

- [x] Supabase Auth — Google + Kakao 소셜 로그인
- [x] 프로필 설정 화면 (닉네임, 프로필 이미지, 상태 메시지)
- [x] `middleware.ts` — 비인증 사용자 리다이렉트
- [ ] 목업 users → `users` 테이블 교체 (각 화면 Task에서 처리)

### 2. 홈 백엔드 연결

- [ ] `schedules` CRUD Route Handler
- [ ] `groups` 확정 일정 자동 동기화 (confirmed_date 기반)
- [ ] 목업 → `schedules` + `groups` 실 데이터 교체

### 3. 친구 / 그룹 백엔드 연결

- [ ] `friendships` 친구 요청·수락 API
- [ ] `groups` + `group_members` 그룹 생성·관리
- [ ] 목업 → 실 데이터 교체

### 4. 투표 백엔드 연결

- [ ] `vote_sessions` + `votes` CRUD
- [ ] Supabase Realtime 구독 (`votes:${sessionId}` 채널)
- [ ] 투표 집계 로직 (최적 날짜 자동 추천)
- [ ] 호스트 확정 → `groups.status = 'confirmed'` 업데이트
- [ ] 목업 → 실 데이터 교체

### 5. 지도 백엔드 연결

- [ ] Kakao Local API Route Handler (`/api/places/search`) — 키워드·카테고리 검색
- [ ] `places` 테이블 저장 (선택한 장소)
- [ ] KakaoTalk Share API 연동
- [ ] 목업 → 실 Kakao API + `places` 테이블 교체

### 6. 기록 백엔드 연결

- [ ] `memories` CRUD
- [ ] Supabase Storage 사진 업로드 (최대 5장/그룹)
- [ ] 목업 → 실 데이터 교체

### Phase 2 완료 기준

- [ ] 전체 데모 플로우 실제 데이터로 동작
- [ ] 모든 Supabase 쿼리 RLS 적용 확인
- [ ] `pnpm typecheck && pnpm lint` 클린
- [ ] `pnpm build` 성공

---

## 핵심 데모 플로우 (항상 이 플로우가 최우선)

```
홈(캘린더) → 친구 선택 → 모임 생성 → 투표 → 확정
  → 지도 장소 선택 → 카톡 공유 → 기록 저장
```

---

## 참고 문서

| 문서 | 용도 |
|------|------|
| `docs/SPEC.md` | 화면별 기능 명세 (기능 ID: H/F/V/M/R/C 접두사) |
| `docs/DESIGN_SYSTEM.md` | 컬러·타이포·스페이싱·컴포넌트 규격 — 작업 전 필독 |
| `docs/DATA_MODEL.md` | ERD, CREATE TABLE, RLS 정책 전문 |
| `docs/API.md` | Kakao Maps SDK / Local API / Share API 연동 패턴 |
| `docs/HANDOFF.md` | (Phase 2 진입 시 생성) 프론트엔드 → 백엔드 인수인계 |
