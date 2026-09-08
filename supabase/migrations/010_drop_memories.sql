-- ============================================================
-- 010_drop_memories.sql
-- "기록(History)" 기능 제거: memories 테이블 + 관련 RLS 정책 정리
-- ============================================================

drop policy if exists "memories_select_member" on memories;
drop policy if exists "memories_insert_member" on memories;
drop policy if exists "memories_update_member" on memories;
drop policy if exists "memories_delete_member" on memories;

drop table if exists memories;

-- ============================================================
-- memory-photos Storage 버킷 정리
-- ------------------------------------------------------------
-- Supabase는 보안상 storage.objects / storage.buckets 에 대한 직접 DELETE 를
-- protect_delete() 트리거로 막아둔다. 따라서 이 SQL 안에서는 처리하지 않고
-- 아래 두 단계 중 하나로 수동 정리할 것:
--
-- 1) Supabase Dashboard → Storage → "memory-photos" 버킷 선택 →
--    객체 모두 선택 후 Delete → 우측 상단 버킷 메뉴에서 Delete bucket.
--
-- 2) supabase CLI:
--      supabase storage rm --recursive ss:///memory-photos
--      (또는 management API 의 DELETE /storage/v1/bucket/memory-photos)
-- ============================================================
