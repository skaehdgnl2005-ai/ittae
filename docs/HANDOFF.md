# Phase 1 → Phase 2 Handoff 문서

Phase 1 완료 기준: 모든 화면이 `src/lib/mock/index.ts`의 목업 데이터로 동작 중.
Phase 2 목표: 목업 데이터를 Supabase 실데이터로 교체.

---

## 1. 화면별 목업 데이터 소비 현황

### 홈 (`src/app/(main)/home/page.tsx`)

| 목업 심볼 | 타입 | 용도 |
|-----------|------|------|
| `mockSchedules` | `Schedule[]` | 월별 캘린더 이벤트 점, 선택된 날짜의 일정 목록, 오늘 요약 카드 |
| `mockGroups` | `Group[]` | 선택된 날짜의 모임 일정 표시 (DayEventList) |

컴포넌트 흐름:
- `TodaySummaryCard` ← `mockSchedules`
- `MonthlyCalendar` ← `mockSchedules` (dot 표시용)
- `DayEventList` ← `mockSchedules`, `mockGroups`

### 친구 (`src/app/(main)/friends/page.tsx`)

| 목업 심볼 | 타입 | 용도 |
|-----------|------|------|
| `mockUsers` | `User[]` | 친구 탭 목록 (현재 사용자 제외 필터) |
| `mockGroups` | `Group[]` | 모임 탭 목록 (status 필터 적용) |
| `mockCurrentUserId` | `string` | 본인 제외 필터 (`u.id !== mockCurrentUserId`) |

컴포넌트 흐름:
- `FriendList` ← `mockUsers.filter(u => u.id !== mockCurrentUserId)`
- `GroupCard` ← `mockGroups` (status별 FilterChip 연동)

### 투표 (`src/app/group/[id]/page.tsx`)

| 목업 심볼 | 타입 | 용도 |
|-----------|------|------|
| `mockGroups` | `Group[]` | `params.id`로 현재 모임 조회, 멤버 목록 |
| `mockVoteSession` | `VoteSession` | 후보 날짜 배열, 마감일 |
| `mockVotes` | `Vote[]` | 초기 투표 현황 (useState로 관리) |
| `mockCurrentUserId` | `string` | 본인 투표 구분, 방장 확인 |

컴포넌트 흐름:
- `VoteMatrix` ← session, votes, members, currentUserId, onVote
- `BestDateBanner` ← bestDate (lib/vote.getBestDate 결과)
- `CommentSection` ← votes, members
- `StickyConfirmButton` ← allVoted, isHost, onConfirm

### 지도 (`src/app/(main)/map/page.tsx`)

| 목업 심볼 | 타입 | 용도 |
|-----------|------|------|
| `mockPlaces` | `Place[]` | 지도 마커, 카드 캐러셀, 카테고리 필터 |

컴포넌트 흐름:
- `MapView` ← places (filteredPlaces), selectedPlaceId
- `PlaceCardCarousel` ← places (filteredPlaces), selectedId, onSelect
- 카테고리 필터: `mockPlaces.filter(p => p.category === selectedCategory)`

### 기록 (`src/app/(main)/history/page.tsx`)

| 목업 심볼 | 타입 | 용도 |
|-----------|------|------|
| `mockMemories` | `Memory[]` | 타임라인 표시 (내림차순 정렬), 통계 요약 |
| `mockPlaces` | `Place[]` | 기억 카드에서 장소 이름/정보 표시 (placeId 조인) |

컴포넌트 흐름:
- `StatsSummary` ← mockMemories (count, 최근 날짜 등)
- `TimelineView` ← sorted memories, places

---

## 2. 화면별 예상 API 엔드포인트

### Schedules

```
GET    /api/schedules          Query: ?userId=&month=YYYY-MM
                               Response: { data: Schedule[] }

POST   /api/schedules          Body: { title, date, start_time?, end_time?, memo?, type }
                               Response: { data: Schedule }

PATCH  /api/schedules/[id]     Body: Partial<Schedule>
                               Response: { data: Schedule }

DELETE /api/schedules/[id]     Response: { success: true }
```

### Groups

```
GET    /api/groups             Query: ?userId=&status=voting|confirmed|completed
                               Response: { data: Group[] }  (members 포함)

POST   /api/groups             Body: { name, memberIds: string[] }
                               Response: { data: Group }

PATCH  /api/groups/[id]        Body: { status?, confirmedDate?, placeId? }
                               Response: { data: Group }
```

### Vote Sessions & Votes

```
GET    /api/vote-sessions/[id]          Response: { data: VoteSession }

GET    /api/vote-sessions/[id]/votes    Response: { data: Vote[] }

POST   /api/vote-sessions/[id]/votes    Body: { date, choice, comment? }
                                        Response: { data: Vote }

PATCH  /api/vote-sessions/[id]/votes    Body: { date, choice, comment? }
                                        Response: { data: Vote }
```

### Places (Kakao Local API 래퍼)

```
GET    /api/places/search      Query: ?query=&category=FD6|CE7|SW8&lat=&lng=&radius=
                               Response: { data: Place[] }
                               (Kakao Local API 결과를 Place 타입으로 변환, 최대 15개)
```

### Memories

```
GET    /api/memories           Query: ?userId=
                               Response: { data: Memory[] }  (participants 포함)

POST   /api/memories           Body: { groupId, date, placeId?, photos?, note? }
                               Response: { data: Memory }
```

### Auth (Supabase Auth 내장)

```
POST   /auth/callback          Supabase OAuth 콜백 (Next.js Route Handler)
GET    /api/me                 Response: { data: User }  (현재 로그인 사용자)
```

---

## 3. 목업 → 실데이터 교체 시 수정 파일 목록

### 즉시 교체 대상 (import만 변경)

| 파일 | 현재 import | 교체 방향 |
|------|-------------|-----------|
| `src/app/(main)/home/page.tsx` | `mockSchedules, mockGroups` | 서버 컴포넌트로 전환 + Supabase 쿼리 |
| `src/app/(main)/friends/page.tsx` | `mockUsers, mockGroups, mockCurrentUserId` | 서버 컴포넌트 데이터 prop 전달 |
| `src/app/(main)/map/page.tsx` | `mockPlaces` | API Route `/api/places/search` 호출 |
| `src/app/(main)/history/page.tsx` | `mockMemories, mockPlaces` | 서버 컴포넌트로 전환 |
| `src/app/group/[id]/page.tsx` | `mockGroups, mockVoteSession, mockVotes, mockCurrentUserId` | 서버 데이터 + Realtime 구독 |

### 추가 생성 필요 파일

| 파일 | 설명 |
|------|------|
| `src/app/api/schedules/route.ts` | GET/POST handler |
| `src/app/api/schedules/[id]/route.ts` | PATCH/DELETE handler |
| `src/app/api/groups/route.ts` | GET/POST handler |
| `src/app/api/groups/[id]/route.ts` | PATCH handler |
| `src/app/api/vote-sessions/[id]/votes/route.ts` | GET/POST/PATCH handler |
| `src/app/api/places/search/route.ts` | Kakao Local API 래퍼 |
| `src/app/api/memories/route.ts` | GET/POST handler |
| `src/app/auth/callback/route.ts` | Supabase Auth 콜백 |
| `src/hooks/useVoteRealtime.ts` | votes 테이블 Realtime 구독 훅 |
| `src/hooks/useGroupRealtime.ts` | groups 테이블 Realtime 구독 훅 |

### 삭제 예정

- `src/lib/mock/index.ts` — 실데이터 교체 완료 후 삭제

---

## 4. Supabase Realtime 구독 포인트

### votes 테이블 (투표 실시간 업데이트)

위치: `src/app/group/[id]/page.tsx` (또는 `src/hooks/useVoteRealtime.ts`)

```typescript
// 구독 설정 예시
const channel = supabase
  .channel(`votes:${sessionId}`)
  .on("postgres_changes", {
    event: "*",  // INSERT, UPDATE, DELETE
    schema: "public",
    table: "votes",
    filter: `session_id=eq.${sessionId}`,
  }, (payload) => {
    // votes 상태 업데이트
    setVotes((prev) => {
      // INSERT: prev에 추가
      // UPDATE: 해당 항목 교체
      // DELETE: 해당 항목 제거
    });
  })
  .subscribe();

// cleanup
return () => { supabase.removeChannel(channel); };
```

트리거 조건: 다른 멤버가 투표를 제출/수정할 때마다 모든 참여자의 VoteMatrix가 실시간 갱신.

### groups 테이블 (모임 상태 변경)

위치: `src/app/(main)/friends/page.tsx` 및 `src/app/group/[id]/page.tsx`

```typescript
const channel = supabase
  .channel(`groups:${groupId}`)
  .on("postgres_changes", {
    event: "UPDATE",
    schema: "public",
    table: "groups",
    filter: `id=eq.${groupId}`,
  }, (payload) => {
    // status: voting → confirmed 전환 감지
    // confirmedDate, placeId 업데이트 반영
  })
  .subscribe();
```

트리거 조건: 방장이 일정을 확정(`status = 'confirmed'`)할 때 모든 멤버의 화면에 확정 배너 표시.

### group_members 테이블 (멤버 변경)

위치: 모임 상세 화면 헤더 멤버 수 표시

```typescript
const channel = supabase
  .channel(`group_members:${groupId}`)
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "group_members",
    filter: `group_id=eq.${groupId}`,
  }, handler)
  .subscribe();
```

---

## 5. 타입 매핑: 앱 도메인 타입 ↔ DB Row 타입

| 앱 타입 (`src/types/index.ts`) | DB Row (`src/types/supabase.ts`) | 변환 필요 사항 |
|-------------------------------|----------------------------------|---------------|
| `User` | `Database["public"]["Tables"]["users"]["Row"]` | snake_case → camelCase, email 필드 제거 |
| `Group` | `groups` Row + `group_members` join | `members: User[]` 별도 조인 필요 |
| `VoteSession` | `vote_sessions` Row | `candidateDates` (camelCase) ↔ `candidate_dates` |
| `Vote` | `votes` Row | `sessionId`, `userId` camelCase 변환 |
| `Place` | `places` Row | `imageUrl`, `category` 타입 narrowing |
| `Memory` | `memories` Row + `group_members` join | `participants: User[]` 별도 조인 필요 |
| `Schedule` | `schedules` Row | `startTime`, `endTime` camelCase, `type` 필드 없음 (앱 레벨 계산) |
