-- ============================================================
-- 002_places_kakao_place_id.sql
-- places 테이블에 kakao_place_id 컬럼 추가
-- 생성일: 2026-04-13
-- ============================================================

alter table places add column if not exists kakao_place_id text unique;
