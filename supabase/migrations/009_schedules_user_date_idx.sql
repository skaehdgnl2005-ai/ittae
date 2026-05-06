-- ============================================================
-- 009_schedules_user_date_idx.sql
-- (user_id, date) 복합 인덱스:
--   홈/캘린더 화면의 "이 유저의 이 기간 일정" 조회 경로 가속.
--   에브리타임 import로 유저당 100~200 row가 쌓이면서
--   sequential scan을 피하기 위함.
-- 생성일: 2026-05-06
-- ============================================================

create index if not exists schedules_user_date_idx
  on schedules(user_id, date);
