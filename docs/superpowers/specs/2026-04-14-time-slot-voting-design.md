# 시간표 투표 고도화 설계

## 개요

기존 날짜별 O/△/X 투표를 **날짜 O/X + 30분 단위 시간표 투표**로 대체한다.
when2meet 방식의 시간 그리드를 모바일 웹앱에 맞게 "양끝 클릭" 인터랙션으로 구현한다.

## 핵심 변경 사항

- 기존 3단계 투표(available/maybe/unavailable) → 2단계(O/X)로 단순화
- 30분 단위 시간표 그리드 추가 (12:00~20:00 고정, 16개 슬롯)
- X 표시한 날짜는 시간표에서 비활성화
- 하루에 여러 시간 구간 선택 가능
- 결과: 히트맵 + 최적 시간대 배너 자동 표시

---

## UI 레이아웃

단일 통합 뷰 — 하나의 화면에 수직 배치:

```
┌─────────────────────────────┐
│ 날짜 선택                      │
│ [O 4/25] [O 4/26] [X 4/27]   │
├─────────────────────────────┤
│ ⭐ 4/26(토) 14:00~17:00      │
│    — 4명 전원 가능              │
├─────────────────────────────┤
│ 시간 선택 · 양끝 클릭으로 구간 선택│
│       4/25   4/26   4/27      │
│ 12:00  [ ]    [ ]    ▓▓       │
│ 12:30  [ ]    [ ]    ▓▓       │
│ 13:00  [ ]    [ ]    ▓▓       │
│ 13:30  [ ]    [ ]    ▓▓       │
│ 14:00  [■]    [■]    ▓▓       │
│ 14:30  [■]    [■]    ▓▓       │
│ 15:00  [■]    [■]    ▓▓       │
│ 15:30  [■]    [■]    ▓▓       │
│ 16:00  [ ]    [■]    ▓▓       │
│ ...                           │
├─────────────────────────────┤
│        [투표 완료]              │
└─────────────────────────────┘
```

- 날짜 선택 행: O(보라) / X(회색) / 미선택(점선) 토글
- 구분선 아래 최적 시간대 배너 (보라 배경)
- 시간표 그리드: O 날짜 열만 활성, X/미선택 열은 opacity 0.35
- 선택된 구간: violet-500 배경
- 하단: 투표 완료 버튼

### 히트맵 모드 (결과 보기)

모든 멤버가 날짜 O/X 투표와 O 날짜에 대한 시간 슬롯을 모두 제출했을 때 활성화.
셀 색상이 겹침 인원 수에 따라 변화:

| 인원 | 색상 |
|------|------|
| 0명 | gray-100 |
| 1명 | violet-100 (#ede9fe) |
| 2명 | violet-300 (#c4b5fd) |
| 3명 | violet-500 (#8b5cf6) |
| 전원 | violet-700 (#6d28d9) |

---

## 인터랙션

### 날짜 토글

탭하면 순환: 미선택(—) → O → X → 미선택

### 양끝 클릭 시간 선택

상태 머신:

```
idle → (빈 셀 클릭) → startSelected → (빈 셀 클릭) → rangeComplete → idle
```

- **idle**: 초기 상태. 빈 셀 클릭 시 해당 셀을 시작점으로 표시, startSelected로 전환.
- **startSelected**: 시작점이 선택된 상태. 같은 열의 다른 빈 셀 클릭 시 시작~끝 구간 전체 선택, idle로 복귀. 시작점 재클릭 시 취소, idle로 복귀.
- 시작점이 끝점보다 아래면 자동으로 swap.
- 다른 열 클릭 시 시작점 리셋 후 새 열에서 시작.

### 구간 해제

이미 선택된 구간의 아무 셀 클릭 → 해당 구간 전체 해제.

---

## 데이터 모델

### 기존 테이블 변경

**votes**
- `choice` CHECK constraint: `('available', 'maybe', 'unavailable')` → `('available', 'unavailable')`
- 마이그레이션 순서: ① maybe 행 DELETE → ② CHECK constraint 변경

**groups**
- `confirmed_start_time time` 컬럼 추가
- `confirmed_end_time time` 컬럼 추가

### 신규 테이블

```sql
create table time_slots (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references vote_sessions(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now(),
  constraint time_slots_valid_range check (start_time < end_time),
  constraint time_slots_unique unique (session_id, user_id, date, start_time)
);

alter table time_slots enable row level security;
```

### RLS 정책

```sql
-- 같은 모임 멤버만 조회
create policy time_slots_select_member on time_slots for select using (
  exists (
    select 1 from vote_sessions vs
    join group_members gm on gm.group_id = vs.group_id
    where vs.id = time_slots.session_id and gm.user_id = auth.uid()
  )
);

-- 본인 슬롯만 생성
create policy time_slots_insert_self on time_slots for insert with check (
  user_id = auth.uid()
);

-- 본인 슬롯만 삭제 (PUT의 delete+reinsert용)
create policy time_slots_delete_self on time_slots for delete using (
  user_id = auth.uid()
);
```

### Realtime

time_slots 테이블을 Supabase Realtime 대상에 추가.

### TypeScript 타입

```typescript
type VoteChoice = "available" | "unavailable"; // maybe 제거

type TimeSlot = {
  id: string;
  sessionId: string;
  userId: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
};
```

---

## API

### 기존 API 수정

**`POST /api/vote-sessions/[id]/votes`**
- choice에서 `maybe` 값 거부 (400 응답)

**`PATCH /api/vote-sessions/[id]/votes`**
- 동일

**`POST /api/groups/[id]/confirm`**
- Body에 `confirmedStartTime`, `confirmedEndTime` 추가
- groups 테이블의 `confirmed_start_time`, `confirmed_end_time` 업데이트

### 신규 API

**`PUT /api/vote-sessions/[id]/time-slots`**
- 특정 날짜의 시간 구간 일괄 저장
- 해당 유저+날짜의 기존 슬롯 DELETE 후 새 슬롯 INSERT (트랜잭션)
- Request:
  ```json
  {
    "date": "2026-04-26",
    "slots": [
      { "startTime": "14:00", "endTime": "17:00" },
      { "startTime": "18:00", "endTime": "19:00" }
    ]
  }
  ```
- Response: 저장된 TimeSlot[]
- 겹침 방지: delete+reinsert 패턴으로 API 레벨에서 보장

**`GET /api/vote-sessions/[id]/time-slots`**
- 전체 멤버의 시간 슬롯 조회
- Response: TimeSlot[]

---

## 컴포넌트 구조

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| DateToggleRow | `src/components/vote/DateToggleRow.tsx` | 날짜별 O/X 토글 행 |
| BestTimeBanner | `src/components/vote/BestTimeBanner.tsx` | 최적 시간대 배너 |
| TimeGrid | `src/components/vote/TimeGrid.tsx` | 시간표 그리드 컨테이너 |
| TimeColumn | `src/components/vote/TimeColumn.tsx` | 단일 날짜의 시간 슬롯 열 |
| TimeSlotCell | `src/components/vote/TimeSlotCell.tsx` | 개별 30분 셀 |

기존 VoteMatrix.tsx, VoteCell.tsx, BestDateBanner.tsx는 제거하고 위 컴포넌트로 대체.
CommentSection.tsx, StickyConfirmButton.tsx는 유지 (확정 버튼에 시간 정보 추가).

### 훅

| 훅 | 파일 | 역할 |
|---|------|------|
| useTimeSlotSelection | `src/hooks/useTimeSlotSelection.ts` | 양끝 클릭 상태 머신 관리 |
| useVoteRealtime | (기존 수정) | time_slots 채널 구독 추가 |

### 유틸

| 함수 | 파일 | 역할 |
|------|------|------|
| getBestTimeSlot | `src/lib/vote.ts` | 전체 멤버 슬롯에서 최적 겹침 구간 계산 |
| getTimeSlotHeatmap | `src/lib/vote.ts` | 슬롯별 가용 인원 수 집계 |

최적 시간 계산은 클라이언트에서 수행 (MVP 규모: 최대 10명 × 16슬롯 × 5일).

---

## 마이그레이션 순서

1. `time_slots` 테이블 생성 + RLS + Realtime
2. `groups` 테이블에 `confirmed_start_time`, `confirmed_end_time` 추가
3. `votes` 테이블 maybe 행 삭제 + CHECK constraint 변경
4. `pnpm db:types` 실행

---

## 목업 참조

브라우저 목업: `.superpowers/brainstorm/3229-1776137845/content/ui-mockup-v4.html`
