# 된다 (DenDa) — V2 PRD (React Native 포팅용)

> **이 문서의 위치**: 현재 웹앱(Next.js + Supabase)의 모든 기능·UI·도메인 동작을
> React Native 앱(이하 **V2**)으로 다시 만들기 위한 단일 진입점이다.
> 다른 세션의 코딩 에이전트 또는 인간 개발자가 V1 코드 없이도 V2를 처음부터
> 같은 동작으로 짤 수 있도록 작성됐다.
>
> V1 자체에 대한 빠른 코드 지도는 [LLM_CONTEXT.md](LLM_CONTEXT.md)를 보고,
> 본 문서는 **"무엇을·왜·어떻게"** 의 제품·디자인·동작 사양에 집중한다.
>
> 작성 기준일: 2026-05-12 / V1 master commit family `4c05b986` 시점.

---

## 목차

0. [TL;DR · V2 한 페이지 요약](#0-tldr--v2-한-페이지-요약)
1. [프로덕트 개요](#1-프로덕트-개요)
2. [타겟 사용자와 핵심 가치](#2-타겟-사용자와-핵심-가치)
3. [정보 아키텍처 · 네비게이션](#3-정보-아키텍처--네비게이션)
4. [화면별 기능 명세](#4-화면별-기능-명세)
   - 4.1 홈 (캘린더 + 내 일정 + 모임 일정)
   - 4.2 친구 / 내 모임
   - 4.3 모임 만들기
   - 4.4 모임 상세 + 시간 투표
   - 4.5 게스트 투표 (`/g/[code]` → DeepLink)
   - 4.6 친구 초대 수락 (`/i/[code]` → DeepLink)
   - 4.7 지도 + 장소 추천
   - 4.8 로그인 / 프로필 / 온보딩
   - 4.9 글로벌 (탭바 · 에러 · 404 · 오프라인)
5. [도메인 모델](#5-도메인-모델)
6. [백엔드 계약 — API 라우트 그대로 재사용](#6-백엔드-계약--api-라우트-그대로-재사용)
7. [인증 / 권한 / RLS](#7-인증--권한--rls)
8. [실시간 동기화](#8-실시간-동기화)
9. [디자인 시스템 (RN 토큰)](#9-디자인-시스템-rn-토큰)
10. [외부 연동](#10-외부-연동)
11. [Web → RN 변환 매트릭스](#11-web--rn-변환-매트릭스)
12. [V2에서 새로 결정해야 하는 것 (Open Questions)](#12-v2에서-새로-결정해야-하는-것-open-questions)
13. [비기능 요구사항](#13-비기능-요구사항)
14. [V2 단계별 로드맵](#14-v2-단계별-로드맵)
15. [부록 A — Web 라우트 ↔ V2 스크린 매핑](#부록-a--web-라우트--v2-스크린-매핑)
16. [부록 B — 의존성 매핑](#부록-b--의존성-매핑)
17. [부록 C — 디자인 토큰 RN 코드](#부록-c--디자인-토큰-rn-코드)

---

## 0. TL;DR — V2 한 페이지 요약

- **무엇**: 친구와 일정을 맞추고(시간 투표) → 장소 정하고(지도) → 카카오톡으로 공유하는 **모바일 소셜 스케줄링 앱**.
- **왜 V2**: 현재 Next.js 모바일 웹앱(`max-width: 430px`)을 **React Native 네이티브 앱**으로 전환. 푸시 알림, 진짜 카카오 로그인, 카메라/사진 업로드, 백그라운드 실시간 등 네이티브 능력 확보.
- **백엔드**: **그대로 유지**. Supabase(Auth + Postgres + Realtime + Storage) + Next.js API Routes(BFF) + 카카오/구글/Gemini. V2는 **Supabase JS SDK + 기존 API URL 호출 클라이언트**만 만든다.
- **포팅 단위**: 화면 10개, 탭 4개, 딥링크 2개, OAuth 2개(카카오/구글), 외부 SDK 4개(Kakao Maps, Kakao Share, Google Calendar API, Gemini OCR).
- **유지하는 핵심 메커니즘**: ① 30분 슬롯 시간 투표(드래그 멀티 셀렉트), ② 실시간 히트맵, ③ 게스트 투표(브라우저 토큰 → 디바이스 토큰), ④ 카카오 비즈앱 우회 OAuth, ⑤ 에브리타임 OCR, ⑥ Google Calendar 동기화.
- **버려지는 것**: `/history` 라우트 (memories 테이블은 V1에서도 이미 drop됨), 데스크톱 폭 제한, Tailwind v4 클래스, Next.js Server Components.
- **제일 위험한 부분**: Kakao Maps WebView 임베드, 게스트 토큰 → 디바이스 토큰 마이그레이션, 시간 그리드 드래그의 RN Gesture Handler 이식.

---

## 1. 프로덕트 개요

| 항목 | 내용 |
|---|---|
| 서비스명 | **된다** (영문 표기 `DenDa`, 코드베이스 슬러그 `denda`, 폴더명 `moim-harness/harness`) |
| 한 줄 소개 | 친구들과 일정·장소를 맞추고 카카오톡으로 공유하는 올인원 소셜 스케줄링 앱 |
| 카테고리 | 라이프스타일 / 소셜 / 캘린더 |
| 플랫폼 | iOS · Android (React Native, Expo 권장) |
| 지원 언어 | 한국어 only (V2 초기) |
| 최소 OS | iOS 15+, Android 8(API 26)+ |
| 디자인 폭 | 375pt 기준 (iPhone SE~14) — 큰 폰은 그리드 비율로 적응 |
| 다크모드 | 지원 (라이트 기본) |
| 오프라인 | 읽기 캐시 + 큐잉 mutation은 V2 P1 |
| 상태 | 심사위원 시연 + 베타. P0 플로우는 끊김 없이 동작해야 함 |

V1과의 핵심 차이:

| | V1 (모바일 웹) | V2 (RN) |
|---|---|---|
| 셸 | 모바일 브라우저, PWA-like | 네이티브 앱 (Expo Router) |
| 인증 콜백 | 미들웨어 + Next.js redirect | Universal Link / App Link + `expo-linking` |
| 하단탭 | 4개 (`(main)/` 라우트 그룹) | 4개 (Bottom Tab Navigator) |
| 시간 그리드 드래그 | Pointer Events + `touch-action: none` | `react-native-gesture-handler` LongPress + Pan |
| 지도 | Kakao Maps SDK (`<Script>`) | **WebView 임베드** (RN용 SDK 없음) |
| 카카오톡 공유 | Kakao Share JS SDK + clipboard fallback | `react-native-kakao-share-link` |
| OAuth | Supabase Auth(Google) + 자체 카카오 콜백 | `expo-auth-session` + 동일한 Next.js `/auth/callback` 백엔드 재사용 |
| 캘린더 동기화 | 서버 fire-and-forget | 동일하지만 RN은 backgrounded 시 재시도 |
| Realtime | Supabase Realtime WebSocket (브라우저) | 동일 (Supabase JS는 RN 호환). 게스트는 폴링 유지 |
| 에브리타임 OCR | 사진 업로드 (input file) | 카메라/갤러리 (`expo-image-picker`) |

---

## 2. 타겟 사용자와 핵심 가치

### 페르소나

- **P1 — 한국 20대 대학생 (대표 페르소나)**
  - 술자리·동아리·조모임 일정 맞추기에 매주 카톡에서 시달림
  - 에브리타임 시간표를 갖고 있음 (시간표 OCR이 강한 wedge)
  - 카카오톡 공유가 필수. 모임 결성 마지막 액션이 단톡 전송
- **P2 — 직장인 친구 모임 (확장)**
  - Google Calendar 사용자. 회사 일정과 사적 일정 분리
  - 모임 멤버 중 일부가 비회원(게스트) 시나리오 자주 발생

### V2 핵심 가치 (V1과 동일, 강화)

1. **"드래그 한 번"으로 가용 시간을 표현** — 캘린더 양식이 아닌 30분 슬롯 그리드. 본인 슬롯은 ring, 다른 사람은 히트맵.
2. **"방장 없이도 진행"** — 게스트 투표(URL 한 줄)로 비회원도 참여. V2에서는 **딥링크/Universal Link**가 주 진입점.
3. **"한 화면에 한 행동"** — 토스 풍의 시각적 절제. 그라데이션·글래스모피즘·indigo 금지. (디자인 시스템 §9)
4. **"카톡으로 닫는다"** — 모임 결정의 마지막 단계는 항상 카카오톡 공유.

### 시연 시나리오 (5분 데모, 변하지 않음)

```
홈 캘린더 → 친구탭에서 4명 선택 → 모임 만들기 →
후보 날짜 3개 선택 → 멤버 중 1명은 게스트 링크로 입장 →
시간 그리드에 드래그로 가용 시간 입력 → 실시간 히트맵 변화 →
방장이 1순위 시간대 클릭 → 확정 → 홈 캘린더 자동 반영 →
지도에서 강남역 카페 검색 → 카톡 공유
```

---

## 3. 정보 아키텍처 · 네비게이션

### 3.1 네비게이션 그래프 (Expo Router 기준)

```
RootStack (Stack Navigator)
├── (auth)                                  # 비인증 흐름. Stack 안에 modal 가능
│   ├── login                               # 카카오/구글 로그인
│   └── profile/setup                       # 첫 로그인 닉네임/사진
│
├── (tabs)                                  # 4-tab Bottom Tab
│   ├── home                                # 홈 캘린더 (=V1 /home)
│   ├── friends                             # 친구 + 내 모임 통합 (=V1 /friends)
│   ├── create                              # 모임 만들기 (탭 진입 시 폼) (=V1 /create)
│   └── map                                 # 지도/장소 (=V1 /map)
│
├── group/[id]                              # 모임 상세/투표 (=V1 /group/[id])
├── guest/[code]                            # 게스트 투표 (=V1 /g/[code], 딥링크 진입)
├── invite/[code]                           # 친구 초대 수락 (=V1 /i/[code], 딥링크 진입)
├── profile                                 # 내 프로필 (=V1 /profile)
├── modals/
│   ├── add-schedule                        # 개인 일정 추가/수정 시트
│   ├── everytime-import                    # 에브리타임 OCR 다단계
│   ├── add-friend                          # 친구 검색/내 초대링크
│   ├── slot-peek                           # 누가 가능한지 보기
│   └── guest-nickname                      # 게스트 첫 진입 닉네임
└── _error / _not-found                     # 글로벌 fallback
```

> **하단 탭 변경 사항**: V1 SPEC 초안에는 5개(홈/친구/모임만들기+/지도/기록)였으나 현재 V1 코드와 V2는 **4탭(홈/친구/모임만들기/지도)**. 기록(history) 탭과 memories 도메인은 V1에서 이미 폐기됨.

### 3.2 진입점

- **앱 첫 실행**: 인증 상태에 따라 `(auth)/login` 또는 `(tabs)/home`.
- **Universal Link / App Link**:
  - `https://denda.app/i/[code]` → `invite/[code]` (회원/비회원 모두)
  - `https://denda.app/g/[code]` → `guest/[code]` (비회원 OK)
  - `https://denda.app/group/[id]` → `group/[id]` (회원 only, 미인증 시 로그인 후 deferred deeplink)
- **푸시 알림 → 화면**: 알림 페이로드의 `screen` + `params`로 라우팅. `expo-notifications`의 `addNotificationResponseReceivedListener` 사용.

### 3.3 권한이 필요한 화면

| 화면 | 인증 필요? | 가드 |
|---|---|---|
| `(tabs)/home` | **선택** (게스트 모드 허용) | 게스트면 "로그인하면 내 일정도 표시돼요" placeholder |
| `(tabs)/friends`, `create`, `map` | 필수 | 미인증 시 `(auth)/login`으로 redirect (after 쿼리 보존) |
| `group/[id]` | 필수 + 멤버 검증 | 비멤버면 `not-found` |
| `guest/[code]` | 불필요 (브라우저 토큰만) | 회원이고 같은 모임 멤버면 자동 `/group/[id]` redirect |
| `invite/[code]` | 필수 (요청 수락 단계) | 미인증 시 로그인 후 deferred deeplink |
| `profile`, `profile/setup` | 필수 | 미인증 redirect |

V1의 `middleware.ts`는 RN에서 **Navigator 가드 + Auth Listener**로 옮긴다.

---

## 4. 화면별 기능 명세

각 화면은 다음 8개 항목으로 기술한다:

> **목적 / 화면 구성 / 데이터 / 인터랙션 / 상태 / API / 빈상태·로딩·에러 / V2 결정 사항**

> **공통 컴포넌트**: 화면 상단 헤더는 React Navigation의 native header가 아닌, **자체 헤더 컴포넌트**를 사용 (V1은 카드 안에 작성). 공유 컴포넌트는 `components/ui/{Avatar, Badge, Button, Card, Sheet, Input}` (V1 그대로 1:1 포팅).

---

### 4.1 홈 — 캘린더 + 내 일정 + 모임 일정

**목적**: 사용자가 앱을 열었을 때 **오늘 무엇이 있는지** 한 화면에서 보고, 내 일정을 추가하거나 다른 일자에 잡힌 모임을 찾을 수 있다.

**화면 구성** (스크롤 단일 컬럼):

```
┌──────────────────────────────────┐
│ 헤더: "된다" 로고 + (오른쪽) ⚙ 프로필 │
├──────────────────────────────────┤
│ ⚠ Reauth 배너 (Google 토큰 만료 시) │  ← 선택적
├──────────────────────────────────┤
│ 두 칸 행:                          │
│  [에브리타임 가져오기]  [구글 캘린더] │  ← 미연결/연결 라벨 동적
│  마지막 동기화: 5분 전               │  ← Google 동기화 상태 (텍스트 한 줄)
├──────────────────────────────────┤
│  ┌ 월간 캘린더 카드 ────────────┐  │
│  │  ‹ 2026년 5월 ›              │  │
│  │ 일 월 화 수 목 금 토          │  │
│  │ ··· 날짜 그리드 (6주, 42칸)   │  │
│  │  · 오늘: 보라 글로우 원        │  │
│  │  · 선택일: 보라 단색 원        │  │
│  │  · 일정 있는 날: 하단 점        │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│ 섹션: "5월 13일 화요일"             │
│  ▸ 일정 카드 리스트                 │
│   - 개인: 회색 좌측 바, 시간/제목     │
│   - 모임(확정): 보라 좌측 바, 참여자 │
│     아바타 +  G 아이콘(Google 일정) │
│   - 충돌(겹침): 노란 배경 강조       │
│  + [내 일정 추가] (Secondary 버튼)   │
└──────────────────────────────────┘
```

**데이터** (마운트 시 한 번에 fetch):

- `GET /api/schedules?userId=&month=YYYY-MM` → `Schedule[]`
- `GET /api/groups` → `Group[]` (멤버·게스트 포함). 확정 모임은 합성 schedule로 변환(`buildGroupSchedule`)
- `users` 테이블 단건: `google_calendar_synced_at`, `google_calendar_email`, `google_refresh_token` 존재 여부 (Reauth 배너 판정)

**인터랙션**:

- **날짜 탭** → `selectedDate` 변경 (애니메이션 없음, 즉시).
- **‹ ›** → 월 이동. 새 월의 schedules를 fetch.
- **일정 카드 길게 누르기 (300ms)** → ActionSheet (수정/삭제). 모임 일정은 길게 누르기 비활성.
- **[내 일정 추가] 버튼** → `modals/add-schedule` 시트 (제목/날짜/시작·종료 시간/메모).
- **에브리타임 버튼** → `modals/everytime-import` (4단계: 업로드 → 분석 → 미리보기 → 저장).
- **구글 연결 버튼** → 미연결 시 OAuth, 연결 시 "동기화 / 연결 해제" ActionSheet.
- **Reauth 배너 클릭** → OAuth 재시작.

**상태** (로컬 useState):

- `selectedDate: Date` (기본: 오늘)
- `viewMonth: { year, month }`
- `addSheetOpen: boolean`
- `actionSchedule: Schedule | null` (시트로 편집 중인 일정)

**API**:

- `GET /api/schedules`, `POST /api/schedules`, `PATCH /api/schedules/[id]`, `DELETE /api/schedules/[id]`
- `GET /api/groups`
- `POST /api/google/sync` (Pull-to-refresh 또는 stale > 1h일 때 자동, fire-and-forget)
- `POST /api/google/disconnect`
- `POST /api/everytime/parse` (multipart) → `POST /api/everytime/import`
- `DELETE /api/everytime/import` (전체 삭제)

**빈 상태 · 로딩 · 에러**:

- 비로그인: 캘린더는 보이되 "로그인하면 내 일정과 모임이 표시돼요" placeholder + 로그인 CTA
- 일정 없는 날: "이 날은 일정이 없어요" + Secondary CTA 두 개
- Google 토큰 만료: Reauth 배너로 안내, 수동 재인증 후 자동 동기화
- 에브리타임 OCR 실패: 단계별 텍스트 (`jpg/png만 지원`, `5MB 이하`, `다시 시도`)

**V2 결정 사항**:

- **캘린더 컴포넌트**: V1은 자체 구현(`MonthlyCalendar.tsx`). V2도 자체 구현 유지(라이브러리 없음)하거나 `react-native-calendars` 도입. 디자인 토큰(점 색·선택 글로우)과 한국어 요일·`Instrument Serif` 숫자 표시는 자체 구현이 더 정확함 → **자체 구현 권장**.
- **Pull-to-refresh**: V2에서는 RefreshControl로 schedules + groups 새로고침. V1에는 없음.
- **롱프레스 지속시간**: 350ms (V1과 일치, gesture-handler `LongPress` mindurationms).
- **에브리타임 이미지 선택**: `expo-image-picker` (카메라/갤러리). V1처럼 `<input type="file">` 대체.

---

### 4.2 친구 / 내 모임

**목적**: 친구를 검색·추가·관리하고, 내가 속한 모임 목록을 한 화면에서 본다. (V1은 한 페이지에 친구·모임·요청을 모두 노출)

**화면 구성**:

```
┌──────────────────────────────────┐
│ 헤더: "친구"                       │
├──────────────────────────────────┤
│ 받은 친구 요청 (있을 때만)           │
│  ▸ 카드: 아바타 / 닉네임 / [수락][거절]│
├──────────────────────────────────┤
│ ▸ 보낸 요청 (Disclosure, 토글)       │
├──────────────────────────────────┤
│ 검색바 [🔍 닉네임으로 검색]           │
│  → 결과 카드 (관계 상태별 액션)       │
├──────────────────────────────────┤
│ 친구 목록                           │
│  ▸ 아바타 32px + 닉네임 + 상태메시지  │
│  ▸ 친구 0명: "아직 친구가 없어요" placeholder│
├──────────────────────────────────┤
│ 내 모임                            │
│  ▸ 카드: 모임명 / 상태 배지 / 참여자  │
│      아바타 그룹 / 마지막 활동일       │
│  ▸ 상태 필터 칩: 전체/투표중/확정     │
└──────────────────────────────────┘

[FAB] (우측 하단) "+" → AddFriendSheet
```

**데이터** — 마운트 시 3-stage parallel fetch (V1 friends/page.tsx 패턴 그대로):

- Stage 1: `requireAuth()` (서버 컴포넌트의 게이트와 동일 효과를 RN에선 navigator gate로)
- Stage 2: `Promise.all([받은요청, 보낸요청, 친구목록, 내모임])`
- Stage 3: `mapPublicUser/mapGroup`

**인터랙션**:

- 검색바 입력 → 300ms 디바운스 → `POST /api/friends/search` (또는 SDK select)
- 검색결과 카드 액션:
  - `none` → "친구 추가" 버튼 → POST `/api/friends`
  - `pending_sent` → "요청 보냄" 비활성
  - `pending_received` → "수락" / "거절"
  - `accepted` → "친구" 칩
- 친구 카드 탭 → V2 P1: 친구 프로필 모달 (V1 미구현)
- 모임 카드 탭 → `group/[id]` 또는 `guest/[code]` 라우트 (호스트=guest 가능성은 없음)
- FAB → AddFriendSheet (3개 영역: 내 초대링크 복사·카톡 공유, 닉네임 검색, 받은 요청)

**상태**:

- `query: string`, `searchResults: UserSearchResult[]`
- `pendingReceived/Sent`
- `groupFilter: 'all' | 'voting' | 'confirmed'`
- `addSheetOpen`

**API**:

- `GET /api/friends` (양방향 accepted)
- `POST /api/friends` (요청 보내기)
- `PATCH /api/friends/[id]` (`action: 'accept' | 'reject'`)
- `GET /api/groups`
- 검색: SDK `from('users').select(...).ilike('nickname', '%q%').limit(20)` (RLS는 `users_select_friends`로 친구만 보이므로 검색은 `users_select_all_public_minimal` 같은 신규 정책이 필요 → V1엔 별도 검색 RPC가 있다면 그것 사용)

**빈 상태 · 로딩 · 에러**:

- 친구 0명: "아직 친구가 없어요. 우측 하단 + 버튼으로 친구를 초대해보세요."
- 검색 결과 없음: "검색 결과 없음" (검색 결과 0건과 친구 0명을 시각적으로 구분 — V1 fix의 교훈)
- 모임 0개: "첫 모임을 만들어보세요" + Create 탭으로 가는 CTA

**V2 결정 사항**:

- **AddFriendSheet의 카카오톡 공유**: V1은 `Kakao.Share`. V2는 `react-native-kakao-share-link`(템플릿 ID 등록 필요) 또는 OS Share Sheet(`Share.share()`)로 fallback.
- **상태 필터 칩 가로 스크롤**: `<FlatList horizontal>` 또는 `<ScrollView horizontal>`.

---

### 4.3 모임 만들기

**목적**: 모임 이름·후보 날짜·참여자(친구 또는 빈 채로 생성 후 링크 공유)를 입력해 모임을 한 번에 생성한다.

**화면 구성** (수직 스크롤):

```
┌────────────────────────────────┐
│ 헤더: ‹ 뒤로  "모임 만들기"        │
├────────────────────────────────┤
│ 1. 후보 날짜 (필수)               │
│    [캘린더 — 다중 선택 가능]       │
│    선택된 날짜 칩 (가로 스크롤)     │
├────────────────────────────────┤
│ 2. 모임 이름 (필수, ≤30자)        │
│    [____________________]       │
├────────────────────────────────┤
│ 3. 참여자 (선택, 0명 가능)         │
│    [친구 검색바]                  │
│    선택된 칩 + 가로 아바타 리스트   │
│    "친구를 선택하지 않아도 만들 수  │
│     있어요. 만든 후 초대 링크 공유" │
├────────────────────────────────┤
│ 4. 투표 마감 (선택)               │
│    [날짜·시간 picker]             │
├────────────────────────────────┤
│  [모임 만들고 투표 시작] (Primary) │
└────────────────────────────────┘
```

**데이터**:

- `GET /api/friends` (참여자 셀렉터용)

**인터랙션**:

- 후보 날짜 캘린더에서 날짜 탭 → `toggleCandidateDate(dates, date)` 사용
- 친구 검색바: 클라이언트 측 필터(이미 fetch된 friends 목록 안에서)
- 친구 카드 탭 → `memberIds` 토글, 선택된 친구는 칩 + ring 강조
- [모임 만들고 투표 시작]:
  - `POST /api/groups` (name, memberIds) → `groupId`, `inviteCode` 받음
  - `POST /api/vote-sessions` (groupId, candidateDates, deadline?)
  - 두 호출 모두 성공 시 `group/[id]`로 push

**상태**:

- `name`, `memberIds: string[]`, `candidateDates: string[]`, `deadline?: ISO`
- `submitting: boolean`, `error: string | null`

**API**:

- `POST /api/groups`
- `POST /api/vote-sessions`
- `GET /api/friends`

**빈 상태 · 로딩 · 에러**:

- 친구 0명: "친구가 없어도 모임을 만들 수 있어요" 안내 + 검색바 disable
- 검색 결과 없음: "검색 결과 없음"
- POST 실패: 화면 하단 빨간 토스트
- 로딩 중: 버튼 라벨 "만드는 중..." + spinner

**V2 결정 사항**:

- **트랜잭션 안전성**: V1은 두 POST를 순차 호출. group 생성 후 vote_sessions 생성 실패 시 group이 고아가 됨. V2에서도 동일 패턴 유지하거나, **API에 통합 엔드포인트(`POST /api/groups/with-session`) 신설을 우선 고려**. (Open Question §12)
- **마감 기본값**: V1은 비워둠 = 무기한. V2도 동일.

---

### 4.4 모임 상세 + 시간 투표 (가장 복잡한 화면)

**목적**: 모임 멤버·게스트가 30분 슬롯 그리드에 자기 가용 시간을 칠하고, 실시간으로 다른 사람의 가용도(히트맵)를 본다. 방장은 가장 인기있는 시간을 골라 확정한다.

#### 4.4.1 모드

화면은 4가지 모드(상태)로 동작:

1. **VOTING (기본)** — 멤버가 투표 중. 본인 슬롯은 ring, 다른 사람은 음영 히트맵.
2. **VOTING + PEEK** — 슬롯을 탭하면 누가 가능한지 시트(SlotPeekSheet)로 봄. 본인 입력은 비활성.
3. **CONFIRM (방장 전용)** — 베스트 타임 1·2·3순위에서 고르거나 그리드에서 직접 sweep. 전 멤버 투표 완료 시에만 진입 가능.
4. **CONFIRMED** — `group.status === 'confirmed'`. 그리드 비활성, 확정 시간이 큰 텍스트로 표시. 홈 캘린더에 자동 합성.

#### 4.4.2 화면 구성 (VOTING 모드)

```
┌──────────────────────────────────────┐
│ ‹ 뒤로  "강남역 술자리 🍻"  ⚙ 더보기 │
│ 5명 참여 · 게스트 1명                 │
│ [링크 복사] (탭 → 토스트 "복사됨!")    │
├──────────────────────────────────────┤
│ (첫 진입 시) WelcomeVoteBanner        │
│  "꾹 눌러서 드래그하면 시간 선택돼요"   │
├──────────────────────────────────────┤
│ BestTimeBanner (있을 때만)            │
│  ┌ 1순위 ─────────────┐              │
│  │ 5/15 (목) 19:00~21:00  4명 가능 │  │
│  └─────────────────────┘             │
│  (2·3순위 칩 같이 노출, 탭 비활성)     │
├──────────────────────────────────────┤
│ [👁/👁‍🗨] (peek 토글)                  │
│ "시간 선택 · 꾹 눌러서 드래그 또는      │
│  양끝 클릭"                            │
│                                       │
│ ┌─ TimeGrid ──────────────────────┐   │
│ │ 09:00 │ 5/13 │ 5/15 │ 5/17 │ ... │  │
│ │ 09:30 │      │ ████ │      │     │  │
│ │ 10:00 │ ▣▣▣ │ ████ │ ▒▒▒ │     │  │
│ │ ...                                │  │
│ │ 22:30 │      │      │      │     │  │
│ └────────────────────────────────┘   │
│  (셀: 8px 높이, 본인=violet ring,     │
│   다른사람=violet 음영(가용비율 0~1)) │
├──────────────────────────────────────┤
│ CommentSection (있을 때)              │
│  ▸ "회사 야근 가능성 있어요" - 지수    │
├──────────────────────────────────────┤
│ VoteActionBar (sticky bottom)         │
│  [ 저장 ]   [ 확정하기 (방장만) ]     │
└──────────────────────────────────────┘
```

#### 4.4.3 시간 그리드 — 시간·슬롯 정의

- **30분 슬롯 28개**: `09:00 → 22:30` (= V1 `TIME_SLOTS` 상수)
- 행 = 시간, 열 = 후보 날짜 (가로 스크롤 없음, 4~7개 후보를 화면 폭에 맞춰 균등 분할 — flex-1)
- 셀 시각:
  - **본인 선택**: violet-600 ring inset
  - **다른 사람 가용**: violet 단색 음영, opacity = (가용 인원 / (전체 멤버 - 1))
  - **드래그 미리보기**: violet-200 단색
  - **disabled (choice가 'available' 아님)**: gray-200 빗금
- 시간 라벨 열: 좌측 48pt 폭, 매 1시간마다 표시

#### 4.4.4 인터랙션 (가장 중요 — 정확히 포팅)

**탭 (단일 셀 토글)**:
- idle 상태에서 셀 탭 → state = `startSelected`, pendingStart 표시 (해당 셀에 ring)
- startSelected에서 같은 셀 재탭 → 취소
- startSelected에서 다른 날짜 셀 탭 → 새 시작점으로 변경
- startSelected에서 같은 날짜 다른 셀 탭 → 두 셀 사이 범위 선택 → 본인 ranges에 push → markDirty

**길게 누르기 + 드래그 (sweep)**:
- 350ms hold → 드래그 모드 진입 (네이티브 스크롤 차단)
- 드래그하는 동안 `previewIds` 셋에 셀 추가 (preview 시각)
- 손가락 떼면 → `commitSweptSlots(slotIds)` → ranges 병합/머지
- markDirty → effect가 `pendingPersist.nonce` 변화 감지 → PUT 발사

**기존 ranges 클릭**:
- 이미 선택된 셀 탭 → 해당 range 전체 제거 → markDirty

**저장 (PUT)**:
- 마운트 직후 nonce=0이면 무시 (실수로 빈 PUT 보내지 않게)
- nonce 증가 시 변경된 dates만 PUT `/api/vote-sessions/[id]/time-slots` (한 번에 한 date)
- 첫 PUT과 동시에 `POST /api/vote-sessions/[id]/votes` (date, choice='available') — choice는 사실상 항상 available

**peek 모드**:
- 토글 ON 시 셀 탭 → SlotPeekSheet 열림 (해당 (date, time)의 memberIds + guestIds 표시)
- 입력 비활성

**확정 (방장 전용)**:
- "확정하기" 탭 → mode = CONFIRM
- BestTimeBanner의 1·2·3 순위 클릭 가능 → confirmHook (별도의 useTimeSlotSelection 인스턴스)에 그 range 주입
- 또는 그리드에서 직접 sweep
- "일정 확정하기" → `POST /api/groups/[id]/confirm` (confirmedDate, confirmedStartTime, confirmedEndTime) → status='confirmed' → router.refresh

**확정됨**:
- 큰 텍스트로 "5월 15일(목) 19:00 ~ 21:00 확정됐어요!" + 장소 정하기 CTA

#### 4.4.5 데이터 (initial fetch)

- `GET /api/groups/[id]` (members, guests 포함)
- `GET /api/vote-sessions/[id]/votes`
- `GET /api/vote-sessions/[id]/time-slots`
- 위 셋을 한 번의 SSR / 페이지 진입 fetch에서 **병렬로** 가져와 props로 hook에 주입

#### 4.4.6 실시간 (Supabase Realtime)

`useVoteRealtime(sessionId, initialVotes, initialTimeSlots)`:

- 두 채널: `votes:${sessionId}`, `time_slots:${sessionId}`
- INSERT/UPDATE/DELETE 모두 구독
- DELETE 이벤트는 `REPLICA IDENTITY FULL`이 적용된 테이블만 행 데이터를 받음 (V1 마이그 006)
- cleanup: useEffect return에서 `channel.unsubscribe()`

**RN 주의사항**: Supabase JS는 RN에서 그대로 작동하나, 백그라운드 진입 시 WebSocket이 끊긴다. AppState 리스너로 active 복귀 시 재구독 + initial fetch 재실행해 누락 보정.

#### 4.4.7 상태

- `voteHook = useTimeSlotSelection(initialMyTimeSlots)` — 본인 슬롯
- `confirmHook = useTimeSlotSelection([])` — 확정 모드 임시 선택
- `mode: 'vote' | 'confirm'`
- `peekMode: boolean`
- `peekSlot: { date, time } | null`
- `linkCopied: boolean`

#### 4.4.8 빈 상태 · 로딩 · 에러

- 투표 세션 없음: "투표 세션이 없습니다." (실제로는 모임 생성 시 항상 만들어지므로 거의 발생 안 함)
- 비멤버 접근: `not-found`
- 마감(`status !== 'voting'`): 그리드 비활성, 결과 카드만

#### 4.4.9 V2 결정 사항

- **드래그 제스처**: `react-native-gesture-handler`의 `LongPressGestureHandler` (350ms) → `PanGestureHandler`. 셀 hit-testing은 직접 좌표 → 인덱스 변환. (V1처럼 `data-slot` attr로 할 수 없음)
- **셀 컴포넌트 최적화**: 28(행) × 후보일수(최대 7) = 최대 196개. 각 셀이 ring/heatmap을 다시 그리면 비싸다. `React.memo` + `useMemo`로 차단.
- **링크 복사**: `expo-clipboard`. 토스트는 `sonner-native` 또는 자체 Toast.
- **방장 더보기 메뉴**: 모임 이름 변경, 멤버 강퇴, 모임 삭제 (V1엔 없거나 일부만 있음 — 확인 필요)

---

### 4.5 게스트 투표 (`guest/[code]`, 딥링크 진입)

**목적**: 회원이 아닌 사람이 카톡으로 받은 링크 한 번으로 닉네임만 입력하고 시간 투표에 참여.

**진입 시나리오**:

1. 카톡으로 받은 `https://denda.app/g/ABC123` 클릭 → Universal Link → 앱 열림 → `guest/[code]` 라우트.
2. 디바이스에 회원 세션이 있고 `code → group.id`의 멤버이면 → `group/[id]`로 redirect.
3. 그 외 → 게스트 모드.

**화면 구성**: `group/[id]`와 거의 동일하지만:

- 헤더: "게스트로 투표 중" 라벨
- BestTimeBanner는 1·2순위만 (방장 권한 표시 강조 X)
- 확정하기 버튼 없음 (`isHost=false`)
- 첫 진입: GuestNicknameModal (전체 화면) — 모임 이름 + 닉네임 입력 + "참여하기"

**게스트 토큰 (V1 메커니즘)**:

- 첫 진입 시 클라이언트가 `browserToken = uuid()` 생성 → `localStorage.setItem('denda_guest_token_<code>', token)`
- `POST /api/invite/[code]/guests` (body: `{ nickname, browserToken }`) → 서버는 `group_guests` 테이블에 행 생성 (UNIQUE on `group_id, browser_token`).
- 이후 모든 게스트 API 호출은 `headers['x-guest-token'] = token`.

**V2 변환 (중요)**:

- `localStorage` → `expo-secure-store` (또는 `AsyncStorage`. 보안 약함 OK — 토큰 자체가 PII 아님)
- 키: `denda_guest_token_<code>` 그대로
- 토큰 새로 생성 시점: 모달에서 "참여하기" 탭한 직후. (V1 그대로)

**데이터·인터랙션·API**: 4.4와 동일하지만 게스트용 엔드포인트:

- `GET /api/invite/[code]/state` (헤더 `x-guest-token`) — 한 번에 group/voteSession/votes/timeSlots/currentGuestId 묶어서 받음
- `POST /api/invite/[code]/guests` (닉네임 등록)
- `POST/PATCH /api/invite/[code]/votes`
- `PUT /api/invite/[code]/time-slots`

**실시간**: V1은 `useGuestRealtime`로 5초 폴링 (게스트 RLS 복잡성 회피). **V2도 폴링 유지 권장** — RN은 백그라운드 시 WebSocket이 더 깨지므로.

**확정됨 상태**: 읽기 전용 카드 ("일정이 확정되었어요" + 확정 시간/날짜). 시간 그리드 비활성.

**V2 결정 사항**:

- **회원 자동 연결**: 게스트로 참여한 사람이 나중에 회원가입 시, 같은 모임에 자동으로 멤버로 추가? — V1엔 없음. V2 P1.

---

### 4.6 친구 초대 수락 (`invite/[code]`, 딥링크)

**목적**: 친구가 카톡으로 보낸 `https://denda.app/i/[code]` 한 번으로 친구 요청 자동 등록.

**화면**:

```
┌──────────────────────────────────┐
│  [큰 아바타 64px]                  │
│   지수님이                         │
│   친구 요청을 보냈어요             │
│   상태메시지...                    │
│                                   │
│   [수락]  [거절]                   │
└──────────────────────────────────┘
```

**예외 케이스**:

- 미로그인: 로그인 후 deferred deeplink로 다시 이 화면 (Expo Linking deferred)
- 본인 코드: "내 초대 링크예요. 친구에게 공유하세요." + 카톡 공유 버튼
- 이미 친구: "이미 친구예요" 칩

**API**:

- `GET /api/friends/invite/[code]` (또는 V1 SSR — V2는 별도 엔드포인트 필요할 수 있음, V1 코드 확인)
- `POST /api/friends/invite/[code]/accept | reject`

**V2 결정 사항**:

- **OG 미리보기**: V1은 `generateMetadata`로 카톡 미리보기 OG 태그를 동적 생성. V2는 동일한 URL을 카톡이 크롤링하므로 **Web 페이지가 살아있어야 함** — Vercel 배포는 V2 출시 후에도 유지 필수.

---

### 4.7 지도 + 장소 추천

**목적**: 모임 확정 후 또는 단독으로 장소를 검색·선택해 카톡으로 공유.

**화면 구성**:

```
┌──────────────────────────────────┐
│ 카테고리 필터 칩 (가로 스크롤)       │
│  [음식점] [카페] [지하철]            │
├──────────────────────────────────┤
│                                   │
│   ┌── Kakao Map (전체화면) ──┐    │
│   │     ●  ●  ●               │    │
│   │  ●     ▣ (선택)            │    │
│   │     ○ 반경 원 (violet 30%)  │    │
│   │                           │    │
│   │  [📍] (내위치 FAB)         │    │
│   └────────────────────────┘    │
├──────────────────────────────────┤
│ [반경 슬라이더 500m ─●─ 5km]        │
├──────────────────────────────────┤
│ 장소 카드 캐러셀 (가로 스와이프)     │
│  ┌ 장소1 ┐ ┌ 장소2 ┐ ┌ 장소3 ┐   │
│  │ 이름 │  │ 이름 │  │ 이름 │   │
│  │ 거리 │  │ 거리 │  │ 거리 │   │
│  └─────┘  └─────┘  └─────┘   │
│                                   │
│ [선택한 장소 카톡 공유] (Primary)   │
└──────────────────────────────────┘
```

**데이터 흐름**:

1. Geolocation 권한 요청 → 현재 위치
2. `GET /api/places/search?query=<카테고리키워드>&category_group_code=&x=<lng>&y=<lat>&radius=<m>` → Kakao Local API 프록시 → `KakaoPlace[]` (최대 15개)
3. 마커 탭 또는 카드 탭 → `selectedPlaceId` + `POST /api/places` (DB upsert)
4. 카톡 공유 버튼 → 템플릿 (장소명, 주소, 지도 링크, 모임 ID) 전송

**카테고리 코드**:

- `FD6` 음식점
- `CE7` 카페
- `SW8` 지하철

**상태**:

- `selectedCategory: 'FD6' | 'CE7' | 'SW8' | null`
- `radius: number` (기본 1000)
- `center: { lat, lng }`
- `places: KakaoPlace[]`
- `selectedPlaceId: string | null`
- `loading`

**API**:

- `GET /api/places/search`
- `POST /api/places` (선택 시 DB에 저장 후 모임에 연결)

**V2 결정 사항** — **가장 큰 기술적 결정**:

- **Kakao Maps SDK 이식**: Kakao는 RN용 공식 SDK가 없다. 두 가지 옵션:
  - **A. WebView 임베드** (V2 권장). `react-native-webview`로 `KakaoMapProvider`와 같은 HTML 페이지 한 장을 띄우고, postMessage 브릿지로 마커 클릭/지도 이동 이벤트 전달. V1의 `referrerPolicy="no-referrer"` 트릭은 WebView의 `originWhitelist`로 대체.
  - **B. 네이티브 통합** (`react-native-kakao-maps-sdk` 비공식). 안정성 낮고 카카오 비즈앱 등록 필요해질 수 있음 → **비추천**.
- **카카오톡 공유**: `react-native-kakao-share-link`. **카카오 디벨로퍼스에 앱 키 + 템플릿 등록 필수**. V2 P0 작업.
- **지도 권한**: `expo-location` (foreground only).

---

### 4.8 로그인 / 프로필 / 온보딩

#### 로그인

- 화면 중앙: 로고 "된다" + 한 줄 카피
- 두 버튼: [Google로 시작] [카카오로 시작]
- 이용약관 / 개인정보 링크 (텍스트, 외부 브라우저)

**OAuth 흐름 (V1과 동일 백엔드)**:

- **Google**: `expo-auth-session/providers/google` → ID 토큰 → Supabase `signInWithIdToken({ provider: 'google', token })`
- **Kakao**:
  - V1은 비즈앱 등록 우회를 위해 카카오 OAuth → 자체 `/auth/callback/kakao` Route Handler → synthetic email(`kakao_<id>@kakao.local`) + HMAC pw → Supabase admin client로 `users` 행 생성 → 클라이언트는 그 결정적 password로 `signInWithPassword`.
  - V2도 **같은 백엔드 그대로 호출**. `expo-auth-session`의 generic provider로 카카오 인가코드 받음 → 동일한 Next.js 콜백으로 POST → 콜백이 redirect URL로 `app://auth-success?session=...` 같은 deep link 응답 → 앱이 받음.
  - 또는 **WebView로 `/login` 페이지를 띄워 V1과 동일하게 처리** (가장 안전, 코드 재사용 최대).

#### 프로필 셋업 (첫 로그인)

- 닉네임 (필수, ≤ 20자)
- 프로필 이미지 (선택, `expo-image-picker` → Supabase Storage `profile_images` 버킷 업로드)
- 상태 메시지 (선택, ≤ 50자)
- [완료] → `(tabs)/home`

#### 프로필 (마이페이지)

- 아바타 + 닉네임 + 상태메시지 (편집 가능)
- 연결된 계정: Google · 카카오 (해제 가능)
- Google Calendar 연결 / 동기화
- 알림 설정 (V2 P1)
- 로그아웃
- 탈퇴 (V2 P1)

#### 온보딩 (첫 실행, V2 P2)

3단계 페이저: ① 일정 등록 ② 친구 추가 ③ 모임 만들기

---

### 4.9 글로벌 (탭바 · 에러 · 404 · 오프라인)

#### Bottom Tab

```
[홈] [친구] [➕ 모임 만들기] [지도]
```

- 가운데 모임 만들기는 V1 코드에서는 일반 탭. V2는 **가운데 큰 보라 원형 FAB**으로 강조 가능 (디자인 결정).
- 탭 활성 상태: 아이콘 violet-600 + 라벨 violet-600. 비활성: gray-500.
- 탭 높이: 83pt (safe-area 포함). 콘텐츠는 `paddingBottom: 83`.

#### 에러 / 404

- `_error`: 일반 에러 — "문제가 발생했어요" + [홈으로]
- `_not-found`: 404 — "페이지를 찾을 수 없어요"
- `group/not-found`: "이 모임을 찾을 수 없어요" + [홈으로]

#### 오프라인

- 네트워크 감지 (`@react-native-community/netinfo`)
- 화면 상단 노란 배너: "오프라인입니다. 일부 기능이 제한돼요."
- 시간 투표 PUT 실패 → 큐잉 (V2 P1)

---

## 5. 도메인 모델

V1 `src/types/index.ts` 그대로 V2에 복제. (camelCase 도메인 타입은 RN에서도 그대로 유효.)

```ts
type VoteChoice = 'available' | 'maybe' | 'unavailable'  // 'maybe'는 deprecated, 신규 입력 안 함
type GroupStatus = 'voting' | 'confirmed' | 'completed'
type FriendshipStatus = 'pending' | 'accepted'
type ScheduleSource = 'manual' | 'google' | 'everytime'
type RelationshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

type User = {
  id: string
  nickname: string
  profileImageUrl: string | null
  statusMessage: string | null
}

type Guest = {
  id: string
  groupId: string
  nickname: string
  createdAt: string
}

type Group = {
  id: string
  name: string
  hostId: string
  status: GroupStatus
  confirmedDate: string | null
  confirmedStartTime: string | null   // V1 마이그 005에서 추가
  confirmedEndTime: string | null
  placeId: string | null
  createdAt: string
  inviteCode: string | null
  members: User[]
  guests: Guest[]
}

type VoteSession = {
  id: string
  groupId: string
  candidateDates: string[]   // "YYYY-MM-DD"
  deadline: string | null
}

type Vote = {
  id: string
  sessionId: string
  userId: string | null
  guestId: string | null
  date: string
  choice: VoteChoice
  comment: string | null
}

type TimeSlot = {
  id: string
  sessionId: string
  userId: string | null
  guestId: string | null
  date: string         // "YYYY-MM-DD"
  startTime: string    // "HH:MM"
  endTime: string      // "HH:MM"
}

type Place = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  category: 'FD6' | 'CE7' | 'SW8'
  rating: number
  imageUrl: string | null
}

type KakaoPlace = {
  kakaoPlaceId: string
  name: string
  address: string
  roadAddress: string
  latitude: number
  longitude: number
  distance: number
  categoryCode: string
  phone: string
}

type Schedule = {
  id: string
  userId: string
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  memo: string | null
  type: 'personal' | 'group'
  source: ScheduleSource
  externalEventId: string | null
}

type PublicUser = Pick<User, 'id' | 'nickname' | 'profileImageUrl' | 'statusMessage'>
type UserSearchResult = PublicUser & { relationship: RelationshipStatus }
```

### DB 테이블 요약 (Supabase, V2도 그대로)

| 테이블 | 핵심 컬럼 | RLS 요점 | Realtime |
|---|---|---|---|
| `users` | nickname, email(nullable), invite_code(unique), google_refresh_token | self select/update + 친구만 select | X |
| `friendships` | requester_id, receiver_id, status('pending'\|'accepted') | 양방향 select | X |
| `groups` | name, host_id, status, confirmed_date/start_time/end_time, invite_code | 멤버만 select, 호스트만 update | X |
| `group_members` | group_id+user_id PK | 같은 그룹 멤버만 select | X |
| `group_guests` | id, group_id, nickname, browser_token (group_id, browser_token UNIQUE) | 같은 그룹 멤버만 select | **O** |
| `vote_sessions` | group_id, candidate_dates(date[]), deadline | 멤버만 select, 호스트만 insert | X |
| `votes` | session_id, user_id?, guest_id?, date, choice('available'\|'unavailable'), comment | 멤버만 select, self만 write. user_id XOR guest_id | **O** (REPLICA IDENTITY FULL) |
| `time_slots` | session_id, user_id?, guest_id?, date, start_time, end_time | 멤버만 select, self만 write/delete | **O** (REPLICA IDENTITY FULL) |
| `places` | kakao_place_id(unique), name, address, lat/lng, category | 인증된 사용자 모두 R/W | X |
| `schedules` | user_id, title, date, start_time, end_time, memo, source, external_event_id, external_etag, everytime_class_id | self only | X |
| ~~`memories`~~ | (DROPPED in 010) | — | — |

> **함수**: `replace_everytime_schedules(p_user_id, p_payloads jsonb) returns int` — 에브리타임 import 원자적 교체. SECURITY INVOKER (auth.uid() == p_user_id 체크).
> **invite code 생성**: `generate_invite_code()` 6자, 모호 문자(0/O/1/I/L) 제외.

자세한 컬럼·인덱스·RLS 표현식은 V1 `supabase/migrations/001~010` 그대로 유지. V2 마이그 추가 시 `011_*.sql`부터.

---

## 6. 백엔드 계약 — API 라우트 그대로 재사용

V2의 백엔드는 **그대로 V1 Vercel 배포물**(Next.js Route Handlers)이다. RN은 HTTP 클라이언트 한 겹만 만든다.

### Base URL

- Production: `https://denda.app/api`
- Staging/Dev: `https://denda-staging.vercel.app/api` (또는 ngrok 터널)
- Local dev: `http://10.0.2.2:3000/api` (Android 에뮬), `http://localhost:3000/api` (iOS 시뮬)

### 인증 헤더

- **회원**: Supabase JWT cookie / `Authorization: Bearer <access_token>` 자동 포함 (Supabase JS 클라이언트가 처리). 단, V1 Route Handler는 cookie 기반이므로 V2는 **`fetch` 호출 시 `credentials: 'include'`** 또는 Authorization 헤더 양쪽 지원하도록 백엔드 보강 필요. (Open Question §12)
- **게스트**: `x-guest-token: <browser_token>` 헤더 (모든 `/api/invite/[code]/*` 호출).

### 엔드포인트 카탈로그 (V2가 호출하는 모든 것)

#### Auth / OAuth

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/auth/google/connect` | Google Calendar 확장 스코프 OAuth 시작 (consent URL로 redirect). RN은 WebView로 |
| GET | `/api/auth/google/callback` | Google OAuth 콜백. refresh_token 저장 + 첫 동기화 |
| GET | `/auth/callback` | Supabase Auth code → session. 신규면 profile/setup, 기존이면 home으로 redirect |
| GET | `/auth/callback/kakao` | 카카오 비즈앱 우회 콜백. synthetic email + HMAC pw로 users 행 생성/조회 후 signIn |

> **RN 권장**: 두 OAuth 모두 WebView로 V1 페이지를 띄우고, 콜백 페이지가 deep link(`app://auth-success?session=...`)로 응답하게 한다. 코드 변경 최소화.

#### Schedules

| Method | Path | 입력 | 출력 |
|---|---|---|---|
| GET | `/api/schedules?year=&month=` | — | `Schedule[]` (해당 월) |
| POST | `/api/schedules` | `{title, date, startTime?, endTime?, memo?}` | `Schedule` (201) |
| PATCH | `/api/schedules/[id]` | partial Schedule | `Schedule` |
| DELETE | `/api/schedules/[id]` | — | `null` |

#### Groups

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/groups` | 내가 멤버인 모든 group + members + guests (배치 fetch) |
| POST | `/api/groups` | `{name, memberIds?}` → group + invite code 자동 생성 |
| GET | `/api/groups/[id]` | 단건 group + members |
| PATCH | `/api/groups/[id]` | host만 (name, status, confirmedDate) |
| POST | `/api/groups/[id]/confirm` | `{confirmedDate, confirmedStartTime, confirmedEndTime}` → status='confirmed' |

#### Vote Sessions

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/vote-sessions` | `{groupId, candidateDates, deadline?}` |
| GET | `/api/vote-sessions/[id]/votes` | `Vote[]` |
| POST | `/api/vote-sessions/[id]/votes` | `{date, choice, comment?}` |
| PATCH | `/api/vote-sessions/[id]/votes` | 수정 (session, user, date 키) |
| GET | `/api/vote-sessions/[id]/time-slots` | `TimeSlot[]` |
| PUT | `/api/vote-sessions/[id]/time-slots` | `{date, slots: [{startTime, endTime}]}` — 해당 date의 본인 슬롯 통째로 교체 |

#### Invite (게스트용, admin client 사용)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/invite/[code]` | 공개 메타: groupId, name, status, confirmedDate/Time |
| GET | `/api/invite/[code]/state` | 게스트 토큰으로 group/voteSession/votes/timeSlots/currentGuestId 일괄 |
| POST | `/api/invite/[code]/guests` | `{nickname, browserToken}` — 게스트 등록 또는 닉네임 갱신 |
| POST | `/api/invite/[code]/votes` | 게스트 투표 |
| PATCH | `/api/invite/[code]/votes` | 게스트 투표 수정 |
| PUT | `/api/invite/[code]/time-slots` | 게스트 시간 슬롯 |

#### Places

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/places/search?query=&category_group_code=&x=&y=&radius=` | Kakao Local 프록시 → `KakaoPlace[]` |
| POST | `/api/places` | `{kakaoPlaceId, name, address, latitude, longitude, categoryCode}` → upsert |

#### Friends

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/friends` | 양방향 accepted friendships → `User[]` |
| POST | `/api/friends` | `{receiverId}` → 요청 생성 |
| PATCH | `/api/friends/[id]` | `{action: 'accept' \| 'reject'}` |

#### Everytime

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/everytime/parse` | `multipart/form-data` (image: jpeg/png ≤ 5MB) → `{ classes: ParsedClass[] }`. Gemini OCR. |
| POST | `/api/everytime/import` | `{classes, semesterStart, semesterEnd}` → expand 후 `replace_everytime_schedules` RPC → `{insertedCount}` |
| DELETE | `/api/everytime/import` | 사용자 모든 everytime schedules 삭제 |

#### Google Calendar

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/google/sync` | Calendar 변경분 가져와서 schedules 동기화 |
| POST | `/api/google/disconnect` | refresh_token, calendar_email 삭제 + google source schedules 일괄 삭제 |

### 응답 컨벤션

- 성공: 200/201, body는 도메인 객체 (snake_case → camelCase는 V1 Route Handler에서 mapper 경유)
- 클라 에러: 400 / 401 / 403 / 404 / 409 / 413 / 415 / 422
- 서버 에러: 500 / 502
- 에러 body: `{ error: string, code?: string }`

V2 클라이언트는 axios/fetch 래퍼 한 곳에서:

- 401 수신 → Supabase `signOut` + `(auth)/login`
- 403 → "권한이 없어요" 토스트
- 5xx → "서버에 문제가 있어요" 토스트 + Sentry 보고

---

## 7. 인증 / 권한 / RLS

### 7.1 Supabase 설정

- URL: `https://<project>.supabase.co`
- Anon key는 클라이언트 코드에 포함 OK (RLS가 보호)
- **Service role key는 절대 RN에 포함 금지** — 서버(Next.js Route Handler)에서만

### 7.2 Auth providers

- Google OAuth (Supabase 내장)
- 카카오: V1처럼 자체 우회 (synthetic email + HMAC pw). V2는 동일 백엔드 호출.

### 7.3 사용자 식별

- 회원: `auth.uid()` (UUID)
- 게스트: `group_guests.id` + `browser_token` 쿠키/SecureStore. 디바이스 단위, 로그아웃 개념 없음.

### 7.4 RLS 정책 명명 규칙

`{table}_{action}_{role}` — 예: `votes_insert_self`, `groups_select_member`.

### 7.5 Admin client 사용 규칙 (V2도 그대로)

서비스 롤은 **Route Handler 안에서만**:

- 게스트 페이지가 멤버·세션을 한꺼번에 가져올 때
- 친구 아닌 그룹 멤버의 프로필 조회 (예: `/group/[id]` SSR)
- 친구 요청 발신자(미친구) 프로필 조회

**불변 규칙**: admin client 사용 직전에 일반 RLS로 호출자의 권한을 검증해야 한다 (V1과 동일).

### 7.6 V2 토큰 저장

- Supabase 세션: `expo-secure-store` (Supabase JS의 `auth: { storage: SecureStore }` 어댑터)
- 게스트 토큰: `expo-secure-store` 또는 `AsyncStorage`. 키 `denda_guest_token_<code>`

---

## 8. 실시간 동기화

### 8.1 회원 — Supabase Realtime

- 모임 상세 진입 시 `votes:${sessionId}`, `time_slots:${sessionId}` 두 채널 구독
- INSERT/UPDATE/DELETE 모두
- DELETE 이벤트 행 데이터는 `REPLICA IDENTITY FULL`이 적용된 테이블만 수신 (V1 마이그 006)
- Cleanup: useEffect return에서 unsubscribe

### 8.2 게스트 — 폴링

- 5초 간격 `GET /api/invite/[code]/state` 폴링 (V1 `useGuestRealtime`)
- 게스트 RLS 복잡성 회피
- V2도 유지. 백그라운드 진입 시 멈춤, foreground 복귀 시 즉시 1회 fetch + 폴링 재개

### 8.3 RN 백그라운드 처리

- `AppState` 리스너: active 복귀 시 → ① 즉시 GET 1회 ② Realtime 채널 재구독
- 푸시 알림(V2 P1)으로 비활성 시에도 변경 알림 가능

---

## 9. 디자인 시스템 (RN 토큰)

### 9.1 철학 (V1 그대로)

> **한 사람이 만든 것처럼 보이는 앱.** 시스템으로 디자인한다.

핵심 원칙:

1. 한 화면, 한 행동
2. 여백이 디자인이다
3. 텍스트가 UI다
4. 애니메이션은 의미를 가진다

### 9.2 절대 금지 (AI 안티패턴)

- 보라색→핑크 그라데이션 / 글래스모피즘 / 네온
- Inter, Roboto, system-ui 폰트
- 3열 아이콘 그리드, 히어로 섹션 패턴
- 20px 이상 border-radius (12px 카드, 8px 버튼, 50% 아바타만)
- `bg-indigo-500` (Tailwind 기본 보라)

### 9.3 컬러 (RN 토큰)

```ts
// theme/colors.ts
export const violet = {
  50:  '#F5F3FF',
  100: '#EDE9FE',
  200: '#DDD6FE',
  300: '#C4B5FD',
  400: '#A78BFA',
  500: '#8B5CF6',
  600: '#7C3AED',  // primary CTA — 앱의 얼굴
  700: '#6D28D9',
  800: '#5B21B6',
  900: '#4C1D95',
}

export const gray = {
  50:  '#FAFAFA',
  100: '#F4F4F5',
  200: '#E4E4E7',
  300: '#D4D4D8',
  400: '#A1A1AA',
  500: '#71717A',
  600: '#52525B',
  700: '#3F3F46',
  800: '#27272A',
  900: '#18181B',
}

export const semantic = {
  success: '#10B981',
  warning: '#F59E0B',
  danger:  '#EF4444',
  info:    '#3B82F6',
}

export const lightTheme = {
  bgPage: gray[50],     // #FAFAFA
  bgCard: '#FFFFFF',
  border: gray[200],
  textHeading: gray[900],
  textBody: gray[700],
  textCaption: gray[500],
  primary: violet[600],
  ring: violet[600],
}

export const darkTheme = {
  bgPage: '#121212',     // 절대 #000 아님
  bgCard: '#1E1E1E',
  border: '#2E2E2E',
  textHeading: gray[100],
  textBody: gray[200],
  textCaption: gray[400],
  primary: violet[500],  // 한 단계 밝게
  ring: violet[500],
}
```

규칙: 보라색은 화면 면적의 ≤ 10%. CTA·선택·아이콘·배지에만.

### 9.4 타이포그래피

```ts
// 폰트 로드 (expo-font)
// PretendardVariable.ttf, InstrumentSerif-Regular.ttf

export const fonts = {
  body: 'Pretendard',                  // 한글/UI
  numeric: 'InstrumentSerif',          // 캘린더 날짜, 통계
  // mono는 V2 P2
}

export const type = {
  display: { size: 28, weight: '700', lineHeight: 36 },  // 홈 인사말
  title1:  { size: 22, weight: '600', lineHeight: 30 },
  title2:  { size: 18, weight: '600', lineHeight: 26 },
  body1:   { size: 16, weight: '400', lineHeight: 24 },
  body2:   { size: 14, weight: '400', lineHeight: 20 },
  caption: { size: 12, weight: '500', lineHeight: 16 },
  number:  { size: 32, font: 'InstrumentSerif', lineHeight: 40 },
}
```

자간: 한글 0, 영문 -0.01em, 숫자 -0.02em (RN은 `letterSpacing` numeric만).

### 9.5 스페이싱 / 그리드

- 4의 배수
- 좌우 패딩 20pt
- 카드 내부 패딩 16pt
- 섹션 간 32pt
- 하단 탭바 83pt

### 9.6 컴포넌트 규격

- **카드**: bg #FFFFFF, border 1px gray-100, radius 12, shadow `0 2 12 rgba(0,0,0,.06)`. press: scale .98, 150ms
- **Primary 버튼**: bg violet-600, text white, h 52, radius 12, font 16/600
- **Secondary**: bg gray-100, text gray-800, h 48, radius 10
- **Ghost**: transparent, text violet-600
- **Danger**: bg red-50, text red-600
- **아이콘 버튼**: 36x36, radius 8, bg gray-100, border gray-200, shadow-sm
- **아바타**: small 32 / medium 44 / large 64, radius 50%, 그룹 겹침 -8 ml
- **배지**: padding 4/8, radius 6
- **바텀 시트**: radius 16-16-0-0, 핸들 36x4 gray-300, backdrop rgba(0,0,0,.3) (블러 X)

### 9.7 모션 (Reanimated 또는 Moti)

- 마이크로 인터랙션 150ms ease
- 화면 전환 300ms cubic-bezier(.32, .72, 0, 1)
- 콘텐츠 등장 400ms ease-out, stagger 50ms
- 삭제 200ms ease-in
- 동시 모션 ≤ 3개. 무한 반복 금지(스켈레톤만).

### 9.8 시간 그리드 셀 시각 (재명시)

- 셀 높이 8pt (V1과 동일)
- 본인: violet-600 ring inset 2px
- 다른 사람: bg violet-600, opacity = (가용 / (전체 멤버 - 1))
- 드래그 미리보기: bg violet-200
- disabled: bg gray-200 빗금 패턴

---

## 10. 외부 연동

### 10.1 Kakao OAuth (비즈앱 우회)

- V1 메커니즘 그대로 백엔드에 보존: `synthetic email` + HMAC pw + nullable email + `users.invite_code`
- RN에서는 `expo-auth-session` generic provider 또는 WebView로 V1 `/login` 페이지 호출

### 10.2 Kakao Maps SDK (RN: WebView 권장)

- WebView에 자체 호스팅된 HTML 한 장 (지도 컨테이너 + 카카오 SDK script)
- referrer 우회는 WebView의 `originWhitelist` + 정적 페이지의 `<meta name="referrer" content="no-referrer">`
- Bridge: `window.ReactNativeWebView.postMessage(JSON)` 으로 마커 클릭/지도 이동 이벤트 → RN
- RN → WebView: `webViewRef.current.injectJavaScript(...)`

### 10.3 Kakao Share

- `react-native-kakao-share-link` 또는 카카오 SDK + `linking-builder`
- 카카오 디벨로퍼스 콘솔에서 **공유 템플릿 ID 생성** (장소·모임·친구초대 각각)

### 10.4 Google OAuth (Calendar 스코프 포함)

- 로그인용: `expo-auth-session/providers/google` → ID 토큰 → Supabase `signInWithIdToken`
- Calendar 동기화: 별도 OAuth 플로우(refresh_token 필요). V1 백엔드 `/api/auth/google/connect`를 WebView로 호출하면 V1과 동일한 흐름

### 10.5 Google Calendar API

- 모든 호출은 **백엔드만** (refresh_token이 클라에 노출되면 안 됨)
- RN은 `POST /api/google/sync` 트리거만

### 10.6 Gemini OCR (에브리타임)

- `POST /api/everytime/parse`에 multipart 업로드
- RN 이미지 선택: `expo-image-picker` → 결과 URI를 multipart `image` 필드로 (RN의 FormData는 `{uri, name, type}` 객체 지원)
- 5MB 제한 사전 체크

### 10.7 Push 알림 (V2 P1)

- `expo-notifications`
- Supabase Edge Function 또는 Vercel Cron으로 트리거 ("투표 미참여 N명에게 리마인더")
- 페이로드: `{ screen: 'group/[id]', params: { id } }`

### 10.8 딥링크 / Universal Link

- Domain: `denda.app`
- Apple App Site Association + Android assetlinks.json — Vercel에 정적 파일 서빙
- Expo Linking 설정: `expo.scheme = 'denda'`, prefixes = `['denda://', 'https://denda.app']`
- 패스 매핑:
  - `/i/[code]` → `invite/[code]`
  - `/g/[code]` → `guest/[code]`
  - `/group/[id]` → `group/[id]`

---

## 11. Web → RN 변환 매트릭스

| V1 (웹) | V2 (RN) | 메모 |
|---|---|---|
| Next.js App Router | Expo Router (또는 React Navigation) | 파일 기반 라우팅 비슷 |
| Server Components | 일반 컴포넌트 + `useEffect` 첫 fetch (또는 React Query) | RSC 개념 없음 |
| Route Handlers | **백엔드 그대로 호출** | 변경 없음 |
| `useEffect` 데이터 페칭 금지 (V1 룰) | **React Query 권장** — `useQuery`/`useMutation` | RSC 없으니 클라이언트에서 fetch가 정답 |
| Tailwind CSS v4 + `@theme` | NativeWind v4 또는 자체 `theme/` + StyleSheet | NativeWind 추천 (Tailwind 클래스 그대로) |
| `cn()` (clsx + tailwind-merge) | NativeWind면 그대로, 아니면 자체 className 결합 |
| framer-motion | `react-native-reanimated` (v3) + `Moti` | 시트는 `@gorhom/bottom-sheet` |
| lucide-react | `lucide-react-native` (있음) | 동일 SVG |
| `<Script>` 태그 (Kakao SDK) | WebView로 SDK 호스팅 | §10.2 |
| `Pointer Events` + `touch-action: none` | `react-native-gesture-handler` LongPress + Pan | 셀 hit-test 직접 좌표 계산 |
| `localStorage` | `@react-native-async-storage/async-storage` 또는 `expo-secure-store` | 게스트 토큰은 secure-store |
| `navigator.clipboard` | `expo-clipboard` |
| `navigator.geolocation` | `expo-location` |
| `<input type="file">` | `expo-image-picker` |
| `<input type="time">` | `@react-native-community/datetimepicker` |
| `next/image` | `expo-image` (cache 우수) |
| `next/font` | `expo-font` (Pretendard·Instrument Serif TTF 직접 번들) |
| `sonner` 토스트 | `sonner-native` 또는 `react-native-toast-message` |
| `@supabase/ssr` | `@supabase/supabase-js` only + AsyncStorage 어댑터 | RN은 SSR 개념 없음 |
| `middleware.ts` 가드 | Navigator + Auth state listener |
| `metadata`/OG 태그 | Vercel 웹 페이지가 계속 호스팅 — 카톡 미리보기는 웹 URL이 처리 |
| `body { max-width: 430px }` | RN은 폰 폭 그대로 |

### 패키지 권장 set (Expo)

```jsonc
{
  "dependencies": {
    "expo": "^52.x",
    "expo-router": "^4.x",
    "expo-linking": "^7.x",
    "expo-constants": "^17.x",
    "expo-secure-store": "^14.x",
    "expo-clipboard": "^7.x",
    "expo-location": "^18.x",
    "expo-image": "^2.x",
    "expo-image-picker": "^16.x",
    "expo-font": "^13.x",
    "expo-notifications": "^0.29.x",
    "expo-auth-session": "^6.x",
    "expo-web-browser": "^14.x",

    "react-native": "0.76.x",
    "react": "18.3.x",
    "react-native-gesture-handler": "^2.20.x",
    "react-native-reanimated": "^3.16.x",
    "react-native-safe-area-context": "^4.12.x",
    "react-native-screens": "^4.4.x",
    "react-native-webview": "^13.12.x",
    "@react-native-async-storage/async-storage": "^2.1.x",
    "@react-native-community/netinfo": "^11.4.x",
    "@react-native-community/datetimepicker": "^8.2.x",

    "@supabase/supabase-js": "^2.x",
    "@tanstack/react-query": "^5.x",
    "date-fns": "^4.x",
    "lucide-react-native": "^0.x",
    "nativewind": "^4.x",
    "tailwindcss": "^3.x",
    "moti": "^0.29.x",
    "@gorhom/bottom-sheet": "^5.x",
    "sonner-native": "^0.x",

    "react-native-kakao-share-link": "^x"  // 카카오톡 공유
  }
}
```

---

## 12. V2에서 새로 결정해야 하는 것 (Open Questions)

각 항목은 V1에 명시적 답이 없으니 V2 시작 전 결정/검증 필요.

1. **카카오 OAuth in RN**: ① WebView로 V1 `/login` 재사용 ② `expo-auth-session` generic provider로 RN 네이티브 흐름. 안전·속도면 ①, UX면 ②.
2. **Kakao Maps**: WebView 임베드 vs 비공식 RN SDK. **WebView 권장**. 단 성능/제스처 매끄러움 검증 필요.
3. **모임 생성 트랜잭션**: 현재 `POST /groups` → `POST /vote-sessions` 두 호출. RN에서 네트워크 끊김 시 group 고아 발생 가능. 통합 엔드포인트(`POST /api/groups/with-session`) 신설 검토.
4. **API 인증 방식 통일**: V1은 cookie 기반. RN은 cookie를 다루기 번거로움. **모든 Route Handler가 `Authorization: Bearer` 헤더도 받도록 보강**해야 함. (게스트는 별개 헤더)
5. **게스트→회원 전환**: 같은 디바이스에서 게스트로 참여 후 회원가입한 사용자를 자동으로 그룹 멤버로 승격? V1엔 없음. V2 P1.
6. **푸시 알림 트리거 위치**: Supabase Edge Function vs Vercel Cron. 즉시성(투표 시 호스트에게)은 Edge Function이 유리.
7. **방장 더보기 메뉴 범위**: 모임 이름 변경, 멤버 강퇴, 모임 삭제, 모임 종료, 게스트 강퇴. V1 코드에 부분 구현 — V2 시작 시 SPEC 동결 필요.
8. **오프라인 정책**: 시간 투표 중 오프라인이면 PUT 큐잉? 단순 에러 표시? V2 P0는 단순 에러, P1은 큐잉.
9. **이미지 업로드 경로**: profile_images 버킷 경로 컨벤션 (V1 코드에서 확인 필요). Storage RLS도 함께.
10. **가운데 탭 (모임 만들기) FAB 디자인**: 일반 탭 vs 큰 보라 원형 FAB. UX 결정.
11. **에브리타임 학기 입력**: V1은 어떻게 받는가 (수동 입력 / 미리 정의된 학기 / 시간표 자체에 학기 정보)? UI 흐름 재확인.
12. **다크모드 자동 감지**: `useColorScheme` + 사용자 토글 둘 다 지원. 기본 선택은?
13. **시간 그리드 09:00~22:30 제한**: V1은 28슬롯 고정. 야간 모임(23시 이후)·새벽 미팅 수요 발생 시 확장. V2 P1?
14. **Memories(추억 기록) 부활 여부**: V1에서 drop. V2에서 다시 살리면 사진 업로드 + Storage 정책 다시 짜야 함.

---

## 13. 비기능 요구사항

### 성능

- TTFB는 백엔드 그대로이므로 V1과 동일. RN 앱 시작 → `(tabs)/home` 첫 페인트 ≤ 1.5초 (스켈레톤 OK)
- 시간 그리드 60fps 유지. 셀 196개 React.memo + 좌표 기반 hit-test
- 이미지 lazy load (`expo-image` 캐시)

### 접근성

- 터치 타겟 ≥ 44pt (V1 가이드와 동일)
- 아이콘 버튼은 반드시 `accessibilityLabel`
- 스크린 리더: 시간 그리드는 "5월 13일 14시 30분, 본인 선택됨" 같은 라벨
- 색맹 대비: 본인=ring + 다른사람=음영 (색상만이 아닌 형태로 구분 — 이미 V1이 그렇게 함)

### 보안

- service_role 키 RN 절대 미포함
- `expo-secure-store`에 토큰 저장 (Keychain/Keystore)
- 카톡 OAuth synthetic email은 `kakao_<id>@kakao.local` (실제 메일 발송 X)
- 친구 검색 RPC는 `users` 전체 노출 X — 닉네임 prefix 매칭 + 결과 limit + 본인 차단 등 V1 정책 그대로
- 딥링크는 `code` 외 입력값 모두 서버 검증

### 개인정보

- 위치는 사용 시점에만 요청, 저장 X
- 사진 업로드는 사용자 명시적 액션 직후
- 카카오 로그인 시 닉네임/프로필 사진은 사용자 동의 후 저장

### 분석

- (선택) Amplitude/Mixpanel — 핵심 퍼널: 모임 생성 → 첫 투표 → 확정 → 카톡 공유

### 에러 모니터링

- Sentry RN. JS 에러 + 네이티브 크래시
- API 에러 코드별 태그

---

## 14. V2 단계별 로드맵

### Phase 0 — 인프라 (1주)

- Expo 프로젝트 초기화, Expo Router, NativeWind/theme, 폰트 (Pretendard, Instrument Serif)
- Supabase JS 클라이언트 + AsyncStorage 어댑터
- 디자인 시스템 컴포넌트 baseline (`components/ui/{Button, Card, Avatar, Badge, Input, Sheet}`) — V1 코드 1:1 포팅
- 딥링크 (Universal Link/App Link) 설정 + Vercel에 AASA/assetlinks.json 추가
- 기본 탭 4개 라우트 + 로그인 라우트 — 빈 스크린

### Phase 1 — 인증 + 홈 (1.5주)

- Google OAuth (네이티브)
- 카카오 OAuth (WebView 우회 권장)
- 프로필 셋업 화면
- 홈 캘린더 (월간 + 일별 리스트)
- 개인 일정 추가/수정/삭제 (시트)
- 모임 일정 합성 표시

### Phase 2 — 친구·모임·투표 (2.5주)

- 친구 목록·검색·요청 (AddFriendSheet 포함)
- 친구 초대 딥링크 (`invite/[code]`)
- 모임 만들기 (CreateMeetingForm)
- 모임 상세 + 시간 그리드 (가장 어려운 화면 — 1주 단독 할당 권장)
- 실시간 동기화 (Supabase Realtime) + 백그라운드 복귀 처리
- 베스트 타임 / 확정 / 결과 표시

### Phase 3 — 게스트·지도·공유 (1.5주)

- 게스트 투표 딥링크 (`guest/[code]`) + 닉네임 모달 + secure-store 토큰
- 지도 (WebView Kakao Maps)
- 카테고리/반경/장소 카드 캐러셀
- 카카오톡 공유 템플릿 등록 + 공유 액션

### Phase 4 — 캘린더 통합 + OCR (1주)

- Google Calendar 연결 (WebView OAuth) + 동기화 표시
- 에브리타임 OCR (이미지 픽커 + 4단계 시트)

### Phase 5 — 폴리싱 (1주)

- 다크모드 마감
- 빈 상태/에러 메시지 일관화
- 햅틱(`expo-haptics`) — 시간 투표 저장, 확정, 카톡 공유 성공
- Sentry / Crashlytics
- 시연 리허설

**총 8.5주** (한 명 풀타임 기준). 백엔드 변경 최소 → V1 인프라 그대로 활용.

---

## 부록 A — Web 라우트 ↔ V2 스크린 매핑

| V1 라우트 | V2 스크린 | 인증 | 비고 |
|---|---|---|---|
| `/` | redirect → `(tabs)/home` | — | |
| `/home` | `(tabs)/home` | optional | 게스트 모드 허용 |
| `/friends` | `(tabs)/friends` | required | 친구·내모임 통합 |
| `/create` | `(tabs)/create` | required | 모임 생성 폼 |
| `/create/new` | (사용 안 함 또는 동일) | — | V1에서 별도 라우트 존재 — V2는 단일 |
| `/map` | `(tabs)/map` | required | WebView 지도 |
| `/group/[id]` | `group/[id]` | required + 멤버 | 시간 투표 |
| `/g/[code]` | `guest/[code]` | optional + 토큰 | 게스트 투표, 딥링크 |
| `/i/[code]` | `invite/[code]` | required (수락 시) | 친구 초대, 딥링크 |
| `/login` | `(auth)/login` | — | 카카오/구글 |
| `/profile` | `profile` | required | 마이페이지 |
| `/profile/setup` | `(auth)/profile/setup` | required | 첫 로그인 닉네임 |
| `/auth/callback` | (백엔드 그대로) | — | WebView 콜백 |
| `/error.tsx` | `_error` | — | |
| `/not-found.tsx` | `_not-found` | — | |
| `/group/[id]/not-found.tsx` | `group/_not-found` | — | |
| `~~/history~~` | (삭제) | — | V1에서 이미 폐기 |

---

## 부록 B — 의존성 매핑

| V1 (web) | V2 (RN) | 호환성 |
|---|---|---|
| `next 16.2` | `expo ^52` + `expo-router ^4` | 라우팅 개념 유사 |
| `react 19.2` | `react 18.3` | RN은 아직 18 |
| `react-dom` | (없음) | |
| `tailwindcss v4 @theme` | `nativewind ^4` + `tailwindcss ^3.4` | NativeWind v4가 v4 토큰 일부 지원 |
| `framer-motion ^12` | `react-native-reanimated ^3.16` + `moti ^0.29` | API 다름 |
| `@supabase/ssr 0.10` | `@supabase/supabase-js ^2` | RN은 SSR 불필요 |
| `@supabase/supabase-js ^2.103` | 동일 | 그대로 |
| `lucide-react ^1.8` | `lucide-react-native ^0.x` | 같은 아이콘 셋 |
| `date-fns ^4` | 동일 | RN 호환 |
| `sonner ^2` | `sonner-native` | API 약간 다름 |
| `class-variance-authority` + `clsx` + `tailwind-merge` | `nativewind` + `clsx` | tailwind-merge는 RN 의미 약함 |
| `@base-ui/react ^1.3` | (없음) | shadcn/ui 위에 사용. RN은 자체 컴포넌트 |
| `tw-animate-css` | (없음) | Reanimated로 대체 |
| `@google/genai ^1.51` | (백엔드만) | RN 미사용 |
| `vitest 4` | `jest` (Expo 기본) | 테스트 |
| `@testing-library/react` | `@testing-library/react-native` | |

---

## 부록 C — 디자인 토큰 RN 코드

```ts
// theme/index.ts
import { violet, gray, semantic } from './colors'

export const tokens = {
  color: { violet, gray, semantic },
  font: {
    body: 'Pretendard',
    numeric: 'InstrumentSerif',
  },
  type: {
    display: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
    title1:  { fontSize: 22, fontWeight: '600', lineHeight: 30 },
    title2:  { fontSize: 18, fontWeight: '600', lineHeight: 26 },
    body1:   { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    body2:   { fontSize: 14, fontWeight: '400', lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
    number:  { fontSize: 32, fontFamily: 'InstrumentSerif', lineHeight: 40 },
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 32, '3xl': 48 },
  radius: { button: 8, card: 12, sheet: 16, avatar: 9999 },
  shadow: {
    card:        { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    listItem:    { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,  shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    iconButton:  { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2,  shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    violetGlow:  { shadowColor: violet[600], shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  },
  motion: {
    fast:   { duration: 150 },
    base:   { duration: 300 },
    enter:  { duration: 400 },
    exit:   { duration: 200 },
  },
}
```

---

## 변경 이력

- 2026-05-12 — V1 master `4c05b986` 시점에서 초안 작성. 기반: `LLM_CONTEXT.md`, `SPEC.md`, `DESIGN_SYSTEM.md`, `DATA_MODEL.md`, V1 코드(api routes/components/hooks/types) + supabase migrations 001~010.

---

**다음 단계**: 본 문서를 V2 세션의 첫 입력으로 주입하고, §12의 Open Questions를 1순위로 결정한 뒤 Phase 0부터 착수.
