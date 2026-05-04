-- ============================================================
-- 007_everytime_import.sql
-- 에브리타임 시간표 OCR import:
--   - schedules.source check에 'everytime' 추가
--   - schedules.everytime_class_id (그룹 키)
--   - replace_everytime_schedules RPC (delete-then-insert 단일 트랜잭션)
-- 생성일: 2026-05-01
-- ============================================================

-- 1. source check 제약 확장
alter table schedules drop constraint if exists schedules_source_check;
alter table schedules add constraint schedules_source_check
  check (source in ('manual', 'google', 'everytime'));

-- 2. 같은 과목 row 그룹 키
alter table schedules add column everytime_class_id uuid;

-- 3. 사용자별 everytime 일정 일괄 조회·삭제용 인덱스
create index schedules_everytime_idx
  on schedules(user_id, everytime_class_id)
  where source = 'everytime';

-- 4. delete-then-insert 원자성용 RPC
create or replace function replace_everytime_schedules(
  p_user_id uuid,
  p_payloads jsonb
) returns int
language plpgsql
security invoker
as $$
declare
  v_inserted int;
begin
  if auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  delete from schedules where user_id = p_user_id and source = 'everytime';

  insert into schedules (user_id, title, date, start_time, end_time, memo, source, everytime_class_id)
  select
    p_user_id,
    (p->>'title')::text,
    (p->>'date')::date,
    (p->>'start_time')::time,
    (p->>'end_time')::time,
    nullif(p->>'memo', ''),
    'everytime',
    (p->>'everytime_class_id')::uuid
  from jsonb_array_elements(p_payloads) p;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
