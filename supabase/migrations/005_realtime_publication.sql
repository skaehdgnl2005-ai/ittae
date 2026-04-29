-- ============================================================
-- 005_realtime_publication.sql
-- Live heatmap: time_slots / votes 테이블을 supabase_realtime publication에 추가.
-- 이미 추가되어 있으면 무해하게 통과한다.
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
