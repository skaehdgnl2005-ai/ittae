#!/bin/bash
# RLS 정책 확인 스크립트
psql "$DATABASE_URL" -c "
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
