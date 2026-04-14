-- ============================================================
-- 001_initial_schema.sql
-- Ittae 초기 스키마 및 RLS 정책
-- 생성일: 2026-04-13
-- ============================================================

-- ============================================================
-- 1. users (테이블 + RLS 활성화만, 정책은 뒤에서)
-- ============================================================
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  nickname text not null,
  profile_image_url text,
  status_message text,
  created_at timestamptz default now()
);

alter table users enable row level security;

-- ============================================================
-- 2. places
-- ============================================================
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

alter table places enable row level security;

create policy "places_select_all" on places
  for select using (auth.role() = 'authenticated');

create policy "places_insert_auth" on places
  for insert with check (auth.role() = 'authenticated');

create policy "places_update_auth" on places
  for update using (auth.role() = 'authenticated');

create policy "places_delete_auth" on places
  for delete using (auth.role() = 'authenticated');

-- ============================================================
-- 3. friendships
-- ============================================================
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

-- ============================================================
-- users 정책 (friendships 테이블 생성 후)
-- ============================================================
create policy "users_insert_self" on users
  for insert with check (auth.uid() = id);

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

-- ============================================================
-- 4. groups
-- ============================================================
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  host_id uuid references users(id) not null,
  status text check (status in ('voting', 'confirmed', 'completed')) default 'voting',
  confirmed_date date,
  place_id uuid references places(id),
  created_at timestamptz default now()
);

alter table groups enable row level security;

-- ============================================================
-- 5. group_members
-- ============================================================
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table group_members enable row level security;

create policy "group_members_select_member" on group_members
  for select using (
    user_id = auth.uid()
    or group_id in (select group_id from group_members where user_id = auth.uid())
  );

create policy "group_members_insert_host" on group_members
  for insert with check (
    group_id in (select id from groups where host_id = auth.uid())
  );

-- groups 정책 (group_members 테이블 생성 후)
create policy "groups_select_member" on groups
  for select using (
    id in (select group_id from group_members where user_id = auth.uid())
  );

create policy "groups_insert_host" on groups
  for insert with check (auth.uid() = host_id);

create policy "groups_update_host" on groups
  for update using (auth.uid() = host_id);

-- ============================================================
-- 6. vote_sessions
-- ============================================================
create table vote_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade not null,
  candidate_dates date[] not null,
  deadline timestamptz,
  created_at timestamptz default now()
);

alter table vote_sessions enable row level security;

create policy "vote_sessions_select_member" on vote_sessions
  for select using (
    group_id in (select group_id from group_members where user_id = auth.uid())
  );

create policy "vote_sessions_insert_host" on vote_sessions
  for insert with check (
    group_id in (select id from groups where host_id = auth.uid())
  );

-- ============================================================
-- 7. votes
-- ============================================================
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

alter table votes enable row level security;

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

-- ============================================================
-- 8. memories
-- ============================================================
create table memories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) not null,
  date date not null,
  place_id uuid references places(id),
  photos text[] default '{}',
  note text,
  created_at timestamptz default now()
);

alter table memories enable row level security;

create policy "memories_select_member" on memories
  for select using (
    group_id in (select group_id from group_members where user_id = auth.uid())
  );

create policy "memories_insert_member" on memories
  for insert with check (
    group_id in (select group_id from group_members where user_id = auth.uid())
  );

create policy "memories_update_member" on memories
  for update using (
    group_id in (select group_id from group_members where user_id = auth.uid())
  );

create policy "memories_delete_member" on memories
  for delete using (
    group_id in (select group_id from group_members where user_id = auth.uid())
  );

-- ============================================================
-- 9. schedules
-- ============================================================
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

alter table schedules enable row level security;

create policy "schedules_all_self" on schedules
  for all using (auth.uid() = user_id);

-- ============================================================
-- 10. places 추가 컬럼 (002 마이그레이션 통합)
-- ============================================================
alter table places add column if not exists kakao_place_id text unique;
