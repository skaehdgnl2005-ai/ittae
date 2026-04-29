-- ============================================================
-- 002_time_slots.sql
-- 시간표 투표 고도화: time_slots 테이블 + groups 확정 시간 + votes maybe 제거
-- ============================================================

-- 1. time_slots 테이블 생성
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

-- RLS: 같은 모임 멤버만 조회
create policy "time_slots_select_member" on time_slots
  for select using (
    exists (
      select 1 from vote_sessions vs
      join group_members gm on gm.group_id = vs.group_id
      where vs.id = time_slots.session_id and gm.user_id = auth.uid()
    )
  );

-- RLS: 본인 슬롯만 생성
create policy "time_slots_insert_self" on time_slots
  for insert with check (user_id = auth.uid());

-- RLS: 본인 슬롯만 삭제
create policy "time_slots_delete_self" on time_slots
  for delete using (user_id = auth.uid());

-- 2. groups 테이블에 확정 시간 컬럼 추가
alter table groups add column confirmed_start_time time;
alter table groups add column confirmed_end_time time;

-- 3. votes 테이블 maybe 제거
delete from votes where choice = 'maybe';
alter table votes drop constraint if exists votes_choice_check;
alter table votes add constraint votes_choice_check
  check (choice in ('available', 'unavailable'));
