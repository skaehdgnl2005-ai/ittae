-- ============================================================
-- 008_guest_voting.sql
-- 비회원 모임 투표(guest voting)
--   - groups.invite_code (8자 unique 토큰)
--   - group_guests (모임별 게스트: 닉네임 + 브라우저 토큰)
--   - votes / time_slots에 guest_id (XOR with user_id)
-- 작성일: 2026-05-05
-- ============================================================

-- 1. groups에 invite_code 컬럼
alter table groups add column invite_code text unique;

-- 2. group_guests 테이블
create table group_guests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade not null,
  nickname text not null,
  browser_token text not null,
  created_at timestamptz default now(),
  unique(group_id, browser_token)
);

alter table group_guests enable row level security;

-- SELECT: 그룹 멤버는 그 그룹 게스트 조회 가능.
-- INSERT/UPDATE/DELETE는 server-side service-role에서만 처리 → anon/authenticated 정책 없음.
create policy "group_guests_select_member" on group_guests
  for select using (
    group_id in (select group_id from group_members where user_id = auth.uid())
  );

-- 3. votes에 guest_id (XOR with user_id)
alter table votes add column guest_id uuid references group_guests(id) on delete cascade;
alter table votes alter column user_id drop not null;
alter table votes add constraint votes_voter_xor check (
  (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
);

-- 기존 unique(session_id, user_id, date) 제거 → partial unique index로 분리
alter table votes drop constraint votes_session_id_user_id_date_key;
create unique index votes_member_unique on votes(session_id, user_id, date)
  where user_id is not null;
create unique index votes_guest_unique on votes(session_id, guest_id, date)
  where guest_id is not null;

-- 4. time_slots에 guest_id (XOR with user_id)
alter table time_slots add column guest_id uuid references group_guests(id) on delete cascade;
alter table time_slots alter column user_id drop not null;
alter table time_slots add constraint time_slots_voter_xor check (
  (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
);

-- time_slots 기존 unique(session_id, user_id, date, start_time) 분리
alter table time_slots drop constraint if exists time_slots_unique;
create unique index time_slots_member_unique
  on time_slots(session_id, user_id, date, start_time)
  where user_id is not null;
create unique index time_slots_guest_unique
  on time_slots(session_id, guest_id, date, start_time)
  where guest_id is not null;

-- 5. group_guests를 supabase_realtime publication에 추가 (호스트 화면에서 새 게스트 카운트 반영)
do $$
begin
  alter publication supabase_realtime add table group_guests;
exception
  when duplicate_object then null;
end $$;
