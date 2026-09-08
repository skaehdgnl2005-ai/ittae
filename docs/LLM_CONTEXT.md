# LLM Onboarding — 된다 (DenDa) Project Context

이 문서는 **다른 LLM 또는 새 세션의 코딩 에이전트**가 이 레포의 UI·아키텍처·도메인을 빠르게 이해하기 위한 단일 진입점이다.
세부 사양은 각 절 끝의 참조 문서로 위임하고, 여기서는 **"무엇이 어디에 있고 왜 그렇게 동작하는지"** 의 지도를 제공한다.

---

## 0. 한눈에 보기 (TL;DR)

- **앱**: 모바일 웹 기반 소셜 스케줄링 앱. 코드베이스 이름은 `denda`(package.json), 사용자 노출명은 **"된다"**, 폴더명은 `moim-harness/harness`.
- **핵심 가치**: 친구와 일정을 맞추고(투표) → 장소를 정하고(지도) → 카카오톡으로 공유한다.
- **타겟**: 한국 20~30대, 모바일(375px~430px) 우선. PWA 지향, 데스크톱 지원 없음(`max-width: 430px` body).
- **상태**: 심사위원 시연용 MVP. Phase 1·2 완료, 백엔드 Supabase 연결 + 카카오/구글 OAuth + 에브리타임 OCR + 게스트 투표까지 살아있는 코드.
- **배포**: Vercel + Supabase Cloud.

핵심 플로우 한 문장:
> 홈 캘린더 → (친구 추가 / 카톡공유 초대) → 모임 생성 → 후보 날짜 + 시간 그리드 투표(실시간) → 방장 확정 → 지도에서 장소 선정 → 카카오 공유.

---

## 1. 기술 스택과 버전

| 영역 | 기술 | 비고 |
|---|---|---|
| 프레임워크 | **Next.js 16.2** (App Router) | `next dev` / Vercel 배포 |
| UI | **React 19.2** + **Tailwind CSS v4** | `@theme` 토큰 방식, `@import "tailwindcss"` |
| 컴포넌트 | shadcn/ui 일부 + 자체 `src/components/ui/*` | Avatar, Badge, Button, Card, sheet |
| 모션 | framer-motion 12 | 시트, 화면 전환만. 장식 모션 금지 |
| 아이콘 | lucide-react | 1.5px stroke. Gray 500 기본, Violet 600 활성 |
| 백엔드 | **Supabase**(Auth + Postgres + Realtime + Storage) | `@supabase/ssr` 0.10 |
| 지도 | Kakao Maps SDK + Local API + Share API | 비즈 앱 등록 우회를 위해 referrer 트릭 사용 |
| AI | `@google/genai` 1.51 | 에브리타임 시간표 OCR(Gemini) |
| 테스트 | Vitest 4 + Testing Library | `src/**/__tests__/*` |

**제약**:
- `any` 금지, `useEffect` 데이터 페칭 금지(서버 컴포넌트 또는 명시 핸들러),
- 인라인 스타일 금지(Tailwind 전용),
- 컴포넌트 200줄 룰. 예외 2개: [GroupDetailClient.tsx](src/app/group/[id]/GroupDetailClient.tsx)(340줄), `g/[code]/GuestVoteClient.tsx`(267줄).

---

## 2. 라우팅 맵 (URL → 책임)

App Router 그룹 컨벤션:
- `(main)/` — 하단탭 4개가 보이는 메인 셸 (BottomTabNav 자동 부착)
- `group/[id]/` — 모임 상세, 메인 셸 밖
- `i/[code]` — 친구 초대 수락
- `g/[code]` — 게스트 투표 (비로그인 가능)
- `auth/` — OAuth 콜백
- `profile/` — 프로필/온보딩
- `api/` — Route Handlers (모든 mutation은 여기로)

### 페이지 라우트

| Path | 종류 | 핵심 컴포넌트 | 데이터 |
|---|---|---|---|
| `/` | redirect | — | `/home`으로 |
| `/home` | server | [HomeCalendarView](src/components/calendar/HomeCalendarView.tsx) | schedules + groups + Google sync 상태 |
| `/friends` | server | [FriendsView](src/components/friends/FriendsView.tsx) | 친구·요청·내 모임. 3-stage parallel fetch |
| `/create` | server | [CreateMeetingForm](src/components/create/CreateMeetingForm.tsx) | 친구 목록(클라 폼) |
| `/map` | client | [MapView](src/components/map/MapView.tsx) + Kakao SDK | Geolocation + Kakao Local 검색 |
| `/group/[id]` | server → client | [GroupDetailClient](src/app/group/[id]/GroupDetailClient.tsx) | 그룹·세션·votes·time_slots, 실시간 |
| `/i/[code]` | server | InviteAcceptCard | 친구 초대 코드 → 수락 |
| `/g/[code]` | server → client | GuestVoteClient | 게스트(비로그인) 투표 |
| `/login` | client | — | Supabase OAuth 시작 |
| `/profile`, `/profile/setup` | server/client | — | 닉네임/소셜 연결 |

### API 라우트 (전부 Route Handlers)

```
auth/google/{callback,connect}     Google Calendar OAuth (확장 스코프)
auth/callback, /callback/kakao     Supabase Auth 콜백
schedules            GET/POST     ?userId&month=YYYY-MM
schedules/[id]       PATCH/DELETE 개인 일정
groups               GET/POST     멤버 포함 fetch / 모임 생성
groups/[id]          PATCH/DELETE
groups/[id]/confirm  POST         confirmedDate + start/end_time 확정
vote-sessions        POST         후보 날짜 등록(모임 생성과 묶임)
vote-sessions/[id]/votes        POST/PATCH  per-date choice
vote-sessions/[id]/time-slots   PUT         하루치 ranges 통째 교체
invite/[code]        GET          그룹 메타 (게스트용)
invite/[code]/state  GET          폴링 fallback (realtime 안 될 때)
invite/[code]/votes, /time-slots, /guests  게스트 투표 mutation
places               POST         Kakao 장소를 DB에 upsert
places/search        GET          Kakao Local 키워드 검색 프록시
friends, /[id]                   친구 요청·수락·삭제
everytime/parse, /import         Gemini OCR + 시간표 import
google/sync, /disconnect         Calendar refresh sync
```

---

## 3. 디렉토리 지도

```
src/
├── app/
│   ├── (main)/        # 하단탭 4개 — home/friends/create/map
│   ├── group/[id]/    # 모임 상세 (서버 컴포넌트 + GroupDetailClient)
│   ├── i/[code]/      # 친구 초대 (OG 메타 포함)
│   ├── g/[code]/      # 게스트 투표
│   ├── api/           # 모든 mutation Route Handler
│   ├── auth/callback/ # Supabase + Kakao OAuth
│   ├── login/, profile/
│   ├── layout.tsx     # 루트 레이아웃 (폰트, theme)
│   ├── error.tsx, not-found.tsx
│   └── globals.css    # @theme 토큰 정의
│
├── components/
│   ├── ui/            # Avatar, Badge, Button, Card, sheet, input — 디자인 시스템 baseline
│   ├── layout/        # BottomTabNav, LogoutButton
│   ├── calendar/      # 홈/일정 — Home, Monthly, DayEventList, AddPersonalSchedule, Everytime*, Google*
│   ├── friends/       # AddFriendSheet, FriendList, FriendsView, GroupCard, PendingRequests, FilterChip, UserSearchResultCard
│   ├── create/        # CreateMeetingForm, MemberSelector, CandidateDatePicker
│   ├── vote/          # TimeGrid, TimeColumn, TimeSlotCell, BestTimeBanner, CommentSection, ConfirmActionBar, VoteActionBar, GuestNicknameModal, WelcomeVoteBanner
│   └── map/           # KakaoMapProvider, MapView, CategoryFilterBar, RadiusSlider, PlaceCardCarousel, KakaoShareButton
│
├── lib/
│   ├── supabase/      # client.ts, server.ts, admin.ts(service-role), auth.ts, guestAuth.ts
│   ├── api/guest.ts   # /g/[code] 클라이언트용 fetch helper
│   ├── groups/        # getGroupByInviteCode 등
│   ├── google/        # OAuth + Calendar sync
│   ├── everytime/     # OCR 결과 → schedule rows 매퍼
│   ├── gemini/        # @google/genai 래퍼
│   ├── mappers.ts     # DB row → 도메인 타입 (snake_case → camelCase)
│   ├── routes.ts      # ROUTES 상수 + PUBLIC_PATHS
│   ├── vote.ts        # getRankedTimeSlots, isAllVoted, getBestDate
│   ├── candidate-dates.ts, date.ts, share.ts, schedule-conflict.ts
│   └── invite-code.ts, inviteCode.ts, utils.ts(cn)
│
├── hooks/
│   ├── useVoteRealtime.ts   # Supabase Realtime 구독 (votes + time_slots)
│   ├── useGuestRealtime.ts  # 게스트 페이지용
│   ├── useTimeSlotSelection.ts # 드래그 멀티-셀렉트 + ranges 변환
│   ├── useDragSelect.ts     # 포인터 드래그 → 셀 sweep
│   └── useGeolocation.ts
│
└── types/
    ├── index.ts       # 도메인 타입 (User, Group, Vote, TimeSlot, …)
    └── supabase.ts    # `pnpm db:types` 결과 — 직접 수정 금지

supabase/migrations/   # 001~009. 변경 시 db:types 재생성
docs/                  # SPEC.md, DESIGN_SYSTEM.md, DATA_MODEL.md, API.md, HANDOFF.md, phase2-task-prompts.md
```

---

## 4. 도메인 모델 (요약)

`src/types/index.ts` 가 SoT. 핵심 엔티티:

```ts
User { id, nickname, profileImageUrl, statusMessage }
Guest { id, groupId, nickname, createdAt }              // 비로그인 투표자

Group {
  id, name, hostId, status: 'voting'|'confirmed'|'completed',
  confirmedDate, placeId, inviteCode, members: User[], guests: Guest[]
}

VoteSession { id, groupId, candidateDates: 'YYYY-MM-DD'[], deadline }

Vote { id, sessionId, userId|guestId, date, choice: 'available'|'maybe'|'unavailable', comment }
   // 현재 UX는 choice를 사실상 'available'로만 사용 (시간 그리드가 주역).

TimeSlot { id, sessionId, userId|guestId, date, startTime, endTime }
   // PUT으로 한 날짜의 ranges를 통째로 교체.

Place { id, name, address, lat/lng, category: FD6|CE7|SW8, rating, imageUrl }
KakaoPlace { kakaoPlaceId, name, address, roadAddress, lat/lng, distance, categoryCode, phone }

Schedule {
  id, userId, title, date, startTime, endTime, memo,
  type: 'personal'|'group',
  source: 'manual'|'google'|'everytime',
  externalEventId
}
```

DB 스키마와 RLS는 [docs/DATA_MODEL.md](docs/DATA_MODEL.md), 마이그레이션은 `supabase/migrations/001~010`. 필드명은 DB가 `snake_case`, 도메인이 `camelCase` — 변환은 `src/lib/mappers.ts` 가 전담.

---

## 5. 핵심 사용자 플로우

### 5.1 모임 만들기 → 투표 → 확정

1. `/create` (서버) — 친구 목록 fetch → [CreateMeetingForm](src/components/create/CreateMeetingForm.tsx)에서 멤버·후보 날짜 선택.
2. `POST /api/groups` → groups + group_members + vote_sessions를 한 트랜잭션으로 생성하고 `inviteCode` 발급.
3. 멤버는 `/group/[id]`, 비-회원은 `/g/[code]` 로 진입.
4. **시간 그리드 투표** ([GroupDetailClient.tsx](src/app/group/[id]/GroupDetailClient.tsx) + [TimeGrid](src/components/vote/TimeGrid.tsx)):
   - 후보 날짜 × 30분 슬롯 매트릭스. 드래그로 자기 가용 시간을 칠한다(`useTimeSlotSelection`).
   - 다른 멤버의 슬롯은 **항상 켜진 히트맵**으로 깔린다(채도 = 가용 인원 / 전체-1). When2meet 패턴.
   - 본인 선택은 violet 600 ring으로 별도 표시.
   - **저장 모델**: 세션×날짜 단위 PUT. `useEffect`가 `voteHook.pendingPersist.nonce`를 감지하면 `/api/vote-sessions/[id]/time-slots` 로 PUT — `nonce=0`(마운트 직후)는 보내지 않음. 사용자 액션이 일어난 날짜만 다시 발사.
5. **실시간 동기화**: [useVoteRealtime](src/hooks/useVoteRealtime.ts)이 `votes`, `time_slots` 테이블 INSERT/UPDATE/DELETE 를 구독. Realtime publication은 `005_realtime_publication.sql` + `006_realtime_replica_identity.sql` 에 활성화.
6. **확정 모드**: 방장이 `Confirm` 진입 → `BestTimeBanner`의 1·2·3순위에서 고르거나 그리드에서 직접 sweep → `POST /api/groups/[id]/confirm` 으로 `confirmedDate / confirmedStartTime / confirmedEndTime` 저장 → `group.status = 'confirmed'`. 홈 캘린더에 `buildGroupSchedule()` 합성으로 자동 반영.

### 5.2 게스트 투표 (`/g/[code]`)

- 비로그인 OK. 첫 진입 시 `GuestNicknameModal`이 닉네임 받고 `group_guests` 행 생성, `guest_id` 쿠키에 저장.
- API는 `/api/invite/[code]/{votes,time-slots,guests,state}` — 모두 `guest_id` 쿠키로 인증.
- 회원이 같은 모임 멤버라면 자동 redirect → `/group/[id]`.
- 마감(`status !== 'voting'`) 시 read-only 결과 카드.

### 5.3 친구 추가 (`/i/[code]`)

- 사용자별 `users.invite_code` 보유 → 카톡 공유.
- 미로그인 시 로그인 후 같은 경로 복귀(`?next=` 쿼리).
- OG 메타데이터 동적 생성(`generateMetadata`) — 닉네임 미리보기.

### 5.4 캘린더 채우기

- **수동**: `AddPersonalScheduleSheet` → `POST /api/schedules`.
- **Google Calendar**: `/api/auth/google/connect` 로 OAuth → refresh_token 저장 → 홈 진입 시 stale(>1h)이면 `syncUserGoogleCalendar()` fire-and-forget.
- **에브리타임**: 시간표 스크린샷 업로드 → `/api/everytime/parse` (Gemini OCR) → 미리보기 → `/api/everytime/import` 로 `schedules.source = 'everytime'` insert. 단계 컴포넌트 4개: `EverytimeUploadStep / ProgressStep / PreviewStep / ImportSheet`.

### 5.5 지도

- `/map` 은 클라이언트 컴포넌트. `useGeolocation` 으로 현재 위치 → Kakao Local 검색.
- 카테고리 칩(FD6/CE7/SW8) + 반경 슬라이더(500~5000m). 마커 탭 → `/api/places` POST 로 DB upsert(이후 모임 연결용). 카카오톡 공유는 `KakaoShareButton`.

---

## 6. 인증 / 미들웨어 / 권한

- **Supabase Auth**: Google OAuth + Kakao OAuth. Kakao는 비즈 앱 등록 없이 통과시키기 위해 `kakao_<id>@kakao.local` synthetic email + HMAC 결정적 password를 만들어 `users.email` 컬럼을 nullable로 둔다(마이그 003). 자세한 로직은 `src/lib/supabase/auth.ts` 와 `src/app/auth/callback/kakao/route.ts`.
- **middleware.ts**:
  - 모든 경로 가드, public은 `/login`, `/auth`, `/g/`, `/api/invite/`.
  - OAuth `?code=&state=` 가 잘못된 경로에 떨어지면 `/auth/callback` 으로 강제 리라우트(Supabase Site URL 오설정 방어).
  - **개발 환경(`NODE_ENV=development`)은 미인증 통과** — 데모용. 프로덕션 점검 시 주의.
- **RLS**:
  - 모든 테이블 RLS 활성. 정책 명명: `{table}_{action}_{role}` (예 `groups_select_member`).
  - **Admin client(`createAdminClient`, service-role)** 사용처:
    - `/group/[id]` 서버 컴포넌트 — 본인 멤버십을 일반 RLS로 확인 후, 다른 멤버 프로필을 조회할 때(친구 아닌 멤버는 `users` RLS 가 막음).
    - 친구 요청 발신자 프로필(미친구) 조회.
    - **불변 규칙**: admin client는 서버 컴포넌트/Route Handler에서만, 그리고 호출 직전에 본인 권한을 일반 RLS로 검증한 뒤 사용한다.

---

## 7. 디자인 시스템 (요약)

자세한 토큰·컴포넌트 규격은 [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). 여기선 LLM이 일관된 코드를 짜기 위한 최소 규칙만.

### 색상

- `globals.css`의 `@theme` 블록이 진실. Tailwind의 `violet-600`/`gray-500` 등은 **자체 팔레트로 덮어쓴 것**이지 Tailwind 기본 색이 아니다.
- CTA·선택·아이콘·배지에만 violet. 화면의 violet 면적 ≤ 10%.
- 카드 배경은 항상 흰색, 페이지 배경은 `#FAFAFA`(라이트) / `#121212`(다크).
- **금지**: 그라데이션, 글래스모피즘, indigo, 네온, dark `#000`.

### 타이포

- 본문/UI: **Pretendard Variable** (CDN import in `globals.css`)
- 숫자 강조(캘린더 날짜·통계): **Instrument Serif** — `font-serif` 유틸 사용
- Inter / Roboto / system-ui **금지**

### 레이아웃

- `body { max-width: 430px; margin: 0 auto; }` — PC에서도 모바일 폭으로만 렌더된다.
- 좌우 패딩 20px, 4의 배수 spacing scale.
- 카드 radius 12px, 버튼 8px, 아바타만 50%. 20px 이상 radius 금지.
- 하단 탭 83px(safe-area 포함).

### 컴포넌트 베이스

- `src/components/ui/`(Avatar, Badge, Button, Card, sheet, input)가 1차. 새 패턴은 여기를 먼저 보고 재사용.
- 도메인 컴포넌트(`vote/`, `calendar/` 등)는 `ui/` 위에 합성.

### AI 안티패턴 자가 점검

화면을 짜면서 아래 중 하나라도 해당하면 멈추고 수정:
- "v0/Lovable에 한 줄 프롬프트 넣으면 비슷한 게 나올 것 같다"
- 그라데이션·글래스·네온 1개라도 등장
- Inter/Roboto 사용
- violet이 큰 면적을 차지

---

## 8. 데이터 페칭 패턴 (반드시 따라야 함)

1. **서버 컴포넌트 우선**. 화면이 mount-time에 보여야 할 데이터는 페이지 `default async function`에서 `createServerClient()` 로 가져온다. `useEffect` 페칭 금지.
2. **Promise.all 다단계**. 의존성 없는 쿼리는 같은 stage에서 병렬화. `friends/page.tsx`의 3-stage 패턴이 표준 사례.
3. **mutation은 Route Handler**. 클라이언트는 `fetch('/api/...')` 만 호출. SDK 직접 mutation 금지(RLS·검증을 한 곳에 모으기 위함).
4. **Realtime은 hook**. 서버에서 initial state를 prop으로 넣고, 클라이언트는 hook이 추가 변경분만 동기화. 절대 hook이 처음 데이터를 fetch하지 않는다.
5. **타입 매핑은 mapper 경유**. DB row를 컴포넌트로 직접 흘려보내지 않는다 — `mapUser`, `mapGroup`, `mapVote`, `mapTimeSlot`, `mapSchedule`, `mapPublicUser`, `mapGuest`.

---

## 9. 자주 빠지는 함정

| 함정 | 정답 |
|---|---|
| `users` 테이블에서 친구 아닌 그룹 멤버가 안 보임 | `createAdminClient()` 로 RLS 우회. 단 본인 멤버십을 일반 RLS로 먼저 확인할 것. |
| Realtime 변경이 안 옴 | `005_realtime_publication.sql` + `006_realtime_replica_identity.sql` 적용 + table을 publication에 등록. |
| Tailwind에 `bg-indigo-500` 가 작동하지 않거나 디자인이 깨짐 | indigo는 우리 팔레트에 없음. `violet-600`을 사용. |
| 시간 그리드가 마운트 직후 PUT을 발사 | `useTimeSlotSelection.pendingPersist.nonce`가 `0`일 때는 무시. `lastPersistedNonce.current` 비교로 차단(GroupDetailClient의 effect 참고). |
| OAuth 로그인 후 `?code=` 가 홈 등 엉뚱한 곳에 붙음 | middleware가 `/auth/callback`으로 강제 리다이렉트. Supabase Site URL 설정 자체도 점검. |
| 카카오맵 도메인 화이트리스트에 막힘 | `KakaoMapProvider`의 `<Script referrerPolicy="no-referrer" />` 트릭으로 우회. 카카오 비즈앱 등록 안 했음. |
| 200줄 룰 위반 | 새 파일에서 위반하지 말 것. 기존 예외는 `GroupDetailClient.tsx`(340), `GuestVoteClient.tsx`(267) 두 개뿐 — 이 둘은 의도된 예외이므로 분리 PR 만들지 말 것. |

---

## 10. 어디서 무엇을 찾을까 (빠른 색인)

| 알고 싶은 것 | 파일 |
|---|---|
| 라우트·공개 경로 상수 | [src/lib/routes.ts](src/lib/routes.ts) |
| 도메인 타입 SoT | [src/types/index.ts](src/types/index.ts) |
| DB row → 도메인 변환 | [src/lib/mappers.ts](src/lib/mappers.ts) |
| 시간 슬롯 랭킹 / 전원 투표 판정 | [src/lib/vote.ts](src/lib/vote.ts) |
| 드래그 멀티 셀렉트 (시간 그리드) | [src/hooks/useTimeSlotSelection.ts](src/hooks/useTimeSlotSelection.ts), [useDragSelect.ts](src/hooks/useDragSelect.ts) |
| 실시간 구독 | [src/hooks/useVoteRealtime.ts](src/hooks/useVoteRealtime.ts), [useGuestRealtime.ts](src/hooks/useGuestRealtime.ts) |
| Supabase 클라이언트들 | [src/lib/supabase/](src/lib/supabase/) — `client`(브라우저), `server`(RSC/Route), `admin`(service-role), `auth`/`guestAuth`(쿠키) |
| 카카오 로그인 비즈앱 우회 로직 | [src/app/auth/callback/kakao/route.ts](src/app/auth/callback/kakao/route.ts) + `src/lib/supabase/auth.ts` |
| 카카오맵 SDK 로딩·도메인 우회 | [src/components/map/KakaoMapProvider.tsx](src/components/map/KakaoMapProvider.tsx) |
| 에브리타임 OCR 파이프라인 | `src/components/calendar/Everytime*.tsx` + `src/app/api/everytime/{parse,import}/route.ts` + `src/lib/everytime/` + `src/lib/gemini/` |
| Google Calendar 동기화 | `src/lib/google/sync.ts` + `src/app/api/google/sync/route.ts` + `src/components/calendar/GoogleSyncIndicator.tsx` / `ReauthBanner.tsx` |
| 디자인 토큰 | [src/app/globals.css](src/app/globals.css) `@theme` 블록 |
| 하단탭 정의 | [src/components/layout/BottomTabNav.tsx](src/components/layout/BottomTabNav.tsx) |

---

## 11. 명령어

```bash
pnpm dev          # localhost:3000
pnpm build        # 프로덕션 빌드
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest
pnpm db:types     # Supabase → TS 타입 생성 (마이그 변경 후 필수)
```

작업 완료 후 항상 `pnpm typecheck && pnpm lint`. 마이그 변경 시 `pnpm db:types` 까지.

---

## 12. 더 깊이 들어가려면

| 주제 | 문서 |
|---|---|
| 화면별 기능 ID와 우선순위 | [docs/SPEC.md](docs/SPEC.md) |
| 컬러·타이포·컴포넌트 규격 | [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) |
| ERD·테이블·RLS 정책 | [docs/DATA_MODEL.md](docs/DATA_MODEL.md) |
| Kakao API 사용 패턴 | [docs/API.md](docs/API.md) |
| Phase 1→2 마이그레이션 맥락 | [docs/HANDOFF.md](docs/HANDOFF.md) |
| Phase 2 Task별 프롬프트 (히스토리) | [docs/phase2-task-prompts.md](docs/phase2-task-prompts.md) |
| 컴포넌트·Supabase·Kakao 코딩 규칙 | [.claude/rules/components.md](.claude/rules/components.md), [.claude/rules/supabase.md](.claude/rules/supabase.md), [.claude/rules/kakao-maps.md](.claude/rules/kakao-maps.md) |
| 프로젝트 전반 메타 룰 | [CLAUDE.md](CLAUDE.md) |

---

## 13. LLM에게 — 작업 시 체크리스트

새 작업을 받으면 다음 순서로 확인한다:

1. **이 문서 + CLAUDE.md** 먼저 읽었나? (본 문서가 최상위 진입점)
2. 변경 영역의 **세부 문서**(SPEC / DESIGN_SYSTEM / DATA_MODEL)를 봤나?
3. 기존 **mapper / hook / lib**를 재사용했나, 아니면 새로 만들 정당성이 있나?
4. **서버 컴포넌트**로 가능한가? 클라이언트 강제 시 `"use client"` + 이유가 분명한가?
5. mutation은 **Route Handler**를 거치는가?
6. **RLS**가 막히는 케이스가 있다면 admin client 정당성과 권한 체크 순서를 명시했나?
7. **디자인 토큰**(violet 600, Pretendard, 12px radius, 4px grid)을 따랐나? Inter / 그라데이션 / indigo 안 썼나?
8. 컴포넌트 **200줄** 미만인가?
9. 마지막으로 `pnpm typecheck && pnpm lint`.
