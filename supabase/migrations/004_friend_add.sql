-- ============================================================
-- 004_friend_add.sql
-- 친구 추가: invite_code 컬럼 + 백필 + friendships 거절(delete) RLS
-- ============================================================

-- 1. users.invite_code 컬럼 + partial unique index
alter table users add column invite_code text;
create unique index users_invite_code_unique_idx
  on users(invite_code) where invite_code is not null;

-- 2. 6자 invite_code 생성 함수 (혼동 글자 제외)
create or replace function generate_invite_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  end loop;
  return result;
end;
$$;

-- 3. 기존 사용자 백필: 충돌 시 재시도
do $$
declare
  u record;
  attempt int;
  candidate text;
begin
  for u in select id from users where invite_code is null loop
    attempt := 0;
    loop
      candidate := generate_invite_code();
      begin
        update users set invite_code = candidate where id = u.id;
        exit;
      exception when unique_violation then
        attempt := attempt + 1;
        if attempt >= 5 then
          raise exception 'invite_code 생성 5회 실패: user %', u.id;
        end if;
      end;
    end loop;
  end loop;
end $$;

-- 4. 거절을 위한 friendships delete 정책
create policy "friendships_delete_receiver" on friendships
  for delete using (auth.uid() = receiver_id);
