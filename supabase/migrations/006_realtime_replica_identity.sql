-- ============================================================
-- 006_realtime_replica_identity.sql
-- Realtime DELETE 이벤트가 session_id 필터로 인해 드롭되는 문제 해결.
--
-- 배경: Supabase Realtime의 postgres_changes 필터는 DELETE 이벤트의 OLD
-- 레코드에도 적용된다. REPLICA IDENTITY가 DEFAULT(=PK만)이면 OLD에
-- session_id 같은 비-PK 컬럼이 없어 필터 매칭에 실패하고, 브로커가 해당
-- DELETE 이벤트를 클라이언트로 전송하지 않는다.
--
-- 결과 증상: 한 사용자가 시간 슬롯을 저장 후 일부를 지우고 다시 저장해도,
-- 다른 사용자의 화면에서 삭제된 슬롯이 사라지지 않아 히트맵이 누적된 것
-- 처럼 보인다.
--
-- 해결: REPLICA IDENTITY FULL로 변경 → OLD에 모든 컬럼 포함 → 필터 매칭
-- 가능 → DELETE 이벤트가 정상 전송된다.
-- ============================================================

alter table time_slots replica identity full;
alter table votes replica identity full;
