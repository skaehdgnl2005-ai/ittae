-- ============================================================
-- 005_google_calendar.sql
-- Google Calendar 연동 + 개인 일정 직접 추가:
--   - schedules.source / external_event_id / external_etag
--   - users.google_refresh_token / google_calendar_email / google_calendar_synced_at
-- 생성일: 2026-04-27
--
-- [순서 메모] 005 prefix 충돌 — 같은 디렉터리에 005_realtime_publication.sql 도 있음.
--   알파벳 정렬상 005_google_calendar.sql 이 먼저 실행되며,
--   007_everytime_import.sql 이 본 파일에서 만든 schedules.source check 제약을 ALTER 한다.
--   따라서 본 파일을 007 이후로 옮길 수 없다. 다음 마이그레이션은 010 부터 시작할 것.
-- ============================================================

-- 1. schedules 테이블 확장
alter table schedules add column source text not null default 'manual'
  check (source in ('manual', 'google'));

alter table schedules add column external_event_id text;

alter table schedules add column external_etag text;

-- (user_id, external_event_id) 부분 유니크 인덱스 — google 일정 upsert 키
create unique index schedules_user_external_unique_idx
  on schedules(user_id, external_event_id)
  where external_event_id is not null;

-- 2. users 테이블 확장 (Google 계정 연결 정보)
alter table users add column google_refresh_token text;

alter table users add column google_calendar_email text;

alter table users add column google_calendar_synced_at timestamptz;
