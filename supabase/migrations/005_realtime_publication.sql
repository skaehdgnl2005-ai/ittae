-- ============================================================
-- 005_realtime_publication.sql
-- Live heatmap: time_slots / votes 테이블을 supabase_realtime publication에 추가.
-- 이미 추가되어 있으면 무해하게 통과한다.
--
-- [순서 메모] 005 prefix 충돌 — 005_google_calendar.sql 과 동일 prefix.
--   알파벳 정렬상 본 파일이 005_google_calendar.sql 다음에 실행되며 두 파일 사이에
--   직접 의존성은 없다 (서로 다른 테이블/오브젝트). 다음 마이그레이션은 010 부터 시작할 것.
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table time_slots;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table votes;
exception
  when duplicate_object then null;
end $$;
