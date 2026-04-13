# 모임 만들기 화면 설계

**날짜:** 2026-04-14  
**상태:** 승인됨  
**경로:** `src/app/(main)/create/page.tsx`

---

## 개요

`/create` 탭은 현재 1줄짜리 플레이스홀더다. 이 스펙은 해당 화면을 완성된 모임 생성 폼으로 교체한다.

**완성 후 동작:** 모임명 + 참여자 + 후보 날짜 입력 → "모임 만들고 투표 시작" → `POST /api/groups` → `POST /api/vote-sessions` → `/group/[id]` 이동.

---

## 화면 구조

**레이아웃:** 단일 스크롤 폼 (단계별 마법사 아님). 모든 입력 항목이 한 화면에 노출.

```
헤더 (뒤로가기 + 제목)
────────────────────────
섹션 1: 모임 이름 (텍스트 입력)
섹션 2: 참여자 선택 (아바타 가로 스크롤 + 선택 칩)
섹션 3: 후보 날짜 (인라인 미니 캘린더, 멀티 선택)
섹션 4: 투표 마감일 (선택 사항, date input)
CTA 버튼: "모임 만들고 투표 시작"
```

---

## 컴포넌트 구성

### `CreateMeetingPage` (서버 컴포넌트)
- 위치: `src/app/(main)/create/page.tsx`
- 역할: 현재 유저의 친구 목록 조회 (`friendships` 테이블) 후 `CreateMeetingForm`에 전달
- `createServerClient()`로 서버에서 친구 데이터 페치 (useEffect 금지)

### `CreateMeetingForm` (클라이언트 컴포넌트)
- 위치: `src/components/create/CreateMeetingForm.tsx`
- 역할: 전체 폼 상태 관리 + 제출 처리
- Props: `friends: User[]`
- 200줄 초과 시 하위 컴포넌트로 분리

### `MemberSelector` (클라이언트 컴포넌트)
- 위치: `src/components/create/MemberSelector.tsx`
- 역할: 친구 아바타 가로 스크롤 + 선택/해제 토글
- 선택된 친구 → 상단에 칩(pill)으로 표시, × 탭으로 해제
- 본인(current user)은 자동 포함, UI에 표시하지 않음

### `CandidateDatePicker` (클라이언트 컴포넌트)
- 위치: `src/components/create/CandidateDatePicker.tsx`
- 역할: 인라인 미니 캘린더 (date-fns 기반, 기존 `MonthlyCalendar` 패턴 참고)
- 날짜 탭 → 선택/해제 토글 (멀티 선택)
- 과거 날짜 선택 불가 (오늘 이전 비활성)
- 캘린더 하단에 선택된 날짜 칩 요약 표시
- 월 이동 버튼(< >) 포함

---

## 디자인 규격 (DESIGN_SYSTEM.md 기준)

| 요소 | 규격 |
|------|------|
| 페이지 배경 | `bg-gray-50` (#FAFAFA) |
| 섹션 카드 | `bg-white border border-gray-100 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)]` |
| 입력 필드 | `bg-gray-100 rounded-lg px-4 py-3 text-sm` |
| 선택된 날짜 | `bg-violet-600 text-white rounded-full` + `shadow-[0_2px_6px_rgba(124,58,237,0.3)]` |
| 선택 칩 | `bg-violet-100 text-violet-800 rounded-full px-3 py-1 text-xs` |
| 아바타 | `44px` (medium), `border-2 border-white` |
| 선택 링 | 선택 시 `ring-2 ring-violet-600 ring-offset-2` |
| CTA 버튼 | `bg-violet-600 text-white h-[52px] rounded-xl text-base font-semibold` |
| 비활성 CTA | `opacity-40 pointer-events-none` (모임명 없거나 날짜 미선택 시) |
| 구분선 | `h-px bg-gray-100` 사용 금지 — 카드 경계 + `space-y-5`로 대체 |
| 페이지 진입 | `framer-motion`: `opacity: 0→1`, `y: 8→0`, `duration: 0.3` |

---

## 데이터 흐름

```
페이지 진입
└─ [서버] friendships 조회 → User[] 전달

폼 제출
└─ POST /api/groups  { name, memberIds }
   └─ 성공 → groupId 취득
      └─ POST /api/vote-sessions  { groupId, candidateDates, deadline? }
         └─ 성공 → router.push(`/group/${groupId}`)
```

- 두 요청은 순차 처리 (vote-session은 group id 필요)
- 제출 중 CTA 버튼 로딩 상태 (`로딩 중...` 텍스트 + `disabled`)
- 에러 시 CTA 버튼 아래 인라인 에러 메시지 (`text-sm text-red-500`)

---

## 유효성 검사

| 조건 | CTA 비활성 |
|------|-----------|
| 모임 이름 비어있음 | ✓ |
| 후보 날짜 0개 | ✓ |
| 참여자 0명 (본인만) | CTA 활성 — 혼자도 가능 |

---

## 엣지 케이스

- **친구 없음:** "아직 친구가 없어요. 친구 탭에서 추가하세요." 안내 + 참여자 섹션 숨기지 않음 (혼자 진행 가능)
- **제출 실패:** 에러 메시지 표시, 폼 상태 유지 (재시도 가능)
- **마감일 미설정:** `deadline: null`로 전송 (API 허용)

---

## 범위 밖 (이번 구현에서 제외)

- 친구 검색 (기존 friends 페이지에 있음)
- 시간대(time zone) 선택
- 모임 이미지 업로드
