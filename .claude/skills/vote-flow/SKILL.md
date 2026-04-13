---
name: vote-flow
description: 모임 투표 기능을 구현하거나 수정할 때 사용한다. 투표 생성, 참여, 결과 확인, 확정의 전체 플로우를 다룬다.
---

# 투표 플로우 구현

## DB 스키마 (Supabase)
```sql
-- vote_sessions: 투표 세션
create table vote_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id),
  candidate_dates date[] not null,
  deadline timestamptz,
  created_at timestamptz default now()
);

-- votes: 개별 투표
create table votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references vote_sessions(id),
  user_id uuid references users(id),
  date date not null,
  choice text check (choice in ('available', 'maybe', 'unavailable')),
  comment text,
  created_at timestamptz default now(),
  unique(session_id, user_id, date)
);
```

## 실시간 구독
투표 화면은 Supabase Realtime으로 실시간 업데이트한다:
```typescript
supabase.channel(`votes:${sessionId}`)
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "votes",
    filter: `session_id=eq.${sessionId}`,
  }, (payload) => {
    // 매트릭스 UI 즉시 업데이트
  })
  .subscribe();
```

## UI 컴포넌트 구조
```
VotePage
├── VoteHeader          (모임명, 마감일, 참여자 아바타)
├── VoteMatrix          (날짜 × 참여자 격자)
│   ├── VoteDateColumn  (세로: 한 날짜의 모든 참여자 투표)
│   └── VoteCell        (개별 셀: ⭕△❌)
├── VoteComment         (한 줄 코멘트 입력)
├── BestDateBanner      (최적 날짜 자동 하이라이트)
└── ConfirmButton       (하단 고정, 방장만 활성)
```

## 디자인 규격
- 셀 높이: 44px (터치 타겟)
- ⭕ available: violet-500 원
- △ maybe: amber-400 삼각
- ❌ unavailable: gray-300 X
- 최적 날짜 행: violet-50 배경
- 확정 버튼: sticky bottom, violet-600 (방장만)

## 테스트 시나리오
1. 3개 후보 날짜로 투표 세션 생성
2. 4명 참여자가 각각 투표
3. 실시간으로 매트릭스 업데이트 확인
4. 최적 날짜 자동 하이라이트 확인
5. 방장이 확정 → 캘린더 반영 확인
