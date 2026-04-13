# 데이터 모델 & RLS 정책

## ERD

```
users ──────┐
  │         │
  │ 1:N     │ M:N (friendships)
  │         │
  ▼         ▼
schedules  friendships
             │
groups ──────┤ (members: M:N via group_members)
  │          │
  │ 1:1      │
  ▼          │
vote_sessions│
  │          │
  │ 1:N      │
  ▼          │
votes        │
             │
places ──────┘
  │
  │ 1:N
  ▼
memories
```

## 테이블 정의

### users
```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  nickname text not null,
  profile_image_url text,
  status_message text,
  created_at timestamptz default now()
);

alter table users enable row level security;

create policy "users_select_self" on users
  for select using (auth.uid() = id);

create policy "users_update_self" on users
  for update using (auth.uid() = id);

create policy "users_select_friends" on users
  for select using (
    id in (
      select receiver_id from friendships where requester_id = auth.uid() and status = 'accepted'
      union
      select requester_id from friendships where receiver_id = auth.uid() and status = 'accepted'
    )
  );
```

### friendships
```sql
create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references users(id) not null,
  receiver_id uuid references users(id) not null,
  status text check (status in ('pending', 'accepted')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, receiver_id)
);

alter table friendships enable row level security;

create policy "friendships_select_own" on friendships
  for select using (auth.uid() in (requester_id, receiver_id));

create policy "friendships_insert_requester" on friendships
  for insert with check (auth.uid() = requester_id);

create policy "friendships_update_receiver" on friendships
  for update using (auth.uid() = receiver_id);
```

### groups
```sql
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  host_id uuid references users(id) not null,
  status text check (status in ('voting', 'confirmed', 'completed')) default 'voting',
  confirmed_date date,
  place_id uuid references places(id),
  created_at timestamptz default now()
);

create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references users(id),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table groups enable row level security;
alter table group_members enable row level security;

create policy "groups_select_member" on groups
  for select using (
    id in (select group_id from group_members where user_id = auth.uid())
  );

create policy "groups_insert_host" on groups
  for insert with check (auth.uid() = host_id);

create policy "groups_update_host" on groups
  for update using (auth.uid() = host_id);
```

### vote_sessions & votes
```sql
create table vote_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade not null,
  candidate_dates date[] not null,
  deadline timestamptz,
  created_at timestamptz default now()
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references vote_sessions(id) on delete cascade not null,
  user_id uuid references users(id) not null,
  date date not null,
  choice text check (choice in ('available', 'maybe', 'unavailable')) not null,
  comment text,
  created_at timestamptz default now(),
  unique(session_id, user_id, date)
);

alter table vote_sessions enable row level security;
alter table votes enable row level security;

-- 투표는 모임 멤버만 조회/생성 가능
create policy "votes_select_member" on votes
  for select using (
    session_id in (
      select vs.id from vote_sessions vs
      join group_members gm on gm.group_id = vs.group_id
      where gm.user_id = auth.uid()
    )
  );

create policy "votes_insert_self" on votes
  for insert with check (auth.uid() = user_id);

create policy "votes_update_self" on votes
  for update using (auth.uid() = user_id);
```

### places & memories
```sql
create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  category text,
  rating numeric(2,1),
  image_url text,
  created_at timestamptz default now()
);

create table memories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) not null,
  date date not null,
  place_id uuid references places(id),
  photos text[] default '{}',
  note text,
  created_at timestamptz default now()
);

create table schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  title text not null,
  date date not null,
  start_time time,
  end_time time,
  memo text,
  created_at timestamptz default now()
);

alter table places enable row level security;
alter table memories enable row level security;
alter table schedules enable row level security;

create policy "schedules_all_self" on schedules
  for all using (auth.uid() = user_id);
```

## RLS 정책 명명 규칙

`{테이블}_{동작}_{대상}`

예시:
- `users_select_self` — 자기 프로필 조회
- `groups_update_host` — 방장만 모임 수정
- `votes_insert_self` — 자기 투표만 생성

## Realtime 활성화 대상

Supabase Dashboard에서 Realtime 활성화할 테이블:
- `votes` — 투표 실시간 업데이트
- `groups` — 모임 상태 변경 (voting → confirmed)
- `group_members` — 멤버 참여/탈퇴
