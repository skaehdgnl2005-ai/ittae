-- ============================================================
-- 003_kakao_email_nullable.sql
-- 카카오 비사업자 로그인 지원: email 동의항목 없이도 가입 가능하도록
-- email 컬럼을 nullable 로 변경하고, NULL 을 허용하는 partial unique index 로 교체
-- ============================================================

alter table users alter column email drop not null;

alter table users drop constraint if exists users_email_key;

create unique index if not exists users_email_unique_idx
  on users (email)
  where email is not null;
