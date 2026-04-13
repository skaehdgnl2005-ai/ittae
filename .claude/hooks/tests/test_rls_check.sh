#!/bin/bash
# .claude/hooks/tests/test_rls_check.sh
# rls-check.sh 단위 테스트

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../rls-check.sh"
TMPDIR_TEST=$(mktemp -d)
export CLAUDE_PROJECT_DIR="$TMPDIR_TEST"

PASS=0
FAIL=0

cleanup() { rm -rf "$TMPDIR_TEST"; }
trap cleanup EXIT

run_hook() {
  local relpath="$1"
  local content="$2"
  local dir
  dir=$(dirname "$TMPDIR_TEST/$relpath")
  mkdir -p "$dir"
  printf '%s' "$content" > "$TMPDIR_TEST/$relpath"
  printf '{"tool_input":{"file_path":"%s"}}' "$relpath" | bash "$HOOK" 2>/dev/null
  echo $?
}

assert_exit() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo "  ✓ $desc"
    ((PASS++))
  else
    echo "  ✗ $desc  (expected exit $expected, got $actual)"
    ((FAIL++))
  fi
}

# ─── CRITICAL: RLS 없는 CREATE TABLE → exit 2 ────────────────────────────────

echo "[ RLS 누락 — exit 2 기대 ]"

result=$(run_hook "supabase/migrations/20240101_init.sql" \
"CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE
);")
assert_exit "RLS 없는 CREATE TABLE → exit 2" 2 "$result"

result=$(run_hook "supabase/migrations/20240102_groups.sql" \
"CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE group_members (
  group_id uuid REFERENCES groups,
  user_id  uuid NOT NULL
);")
assert_exit "CREATE TABLE 2개 + RLS 없음 → exit 2" 2 "$result"

# ─── 정상: RLS 포함 → exit 0 ─────────────────────────────────────────────────

echo ""
echo "[ RLS 포함 — exit 0 기대 ]"

result=$(run_hook "supabase/migrations/20240101_users.sql" \
"CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
assert_exit "CREATE TABLE + ENABLE ROW LEVEL SECURITY → exit 0" 0 "$result"

result=$(run_hook "supabase/migrations/20240102_multi.sql" \
"CREATE TABLE groups (id uuid PRIMARY KEY);
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE group_members (group_id uuid, user_id uuid);
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;")
assert_exit "테이블 2개 + 각각 RLS → exit 0" 0 "$result"

# RLS만 있고 CREATE TABLE 없는 파일 (기존 테이블 정책 추가)
result=$(run_hook "supabase/migrations/20240103_policies.sql" \
"CREATE POLICY users_select_self ON users
  FOR SELECT USING (auth.uid() = id);")
assert_exit "CREATE TABLE 없는 정책 파일 → exit 0" 0 "$result"

# ─── 무시 케이스 (exit 0 기대) ───────────────────────────────────────────────

echo ""
echo "[ 무시 케이스 — exit 0 기대 ]"

result=$(run_hook "src/components/Card.tsx" \
"export const Card = () => <div>hello</div>;")
assert_exit "TSX 파일 → exit 0 (무시)" 0 "$result"

result=$(run_hook "supabase/seed.sql" \
"INSERT INTO users (email) VALUES ('test@example.com');")
assert_exit "migrations 디렉토리 아닌 SQL → exit 0 (무시)" 0 "$result"

result=$(run_hook "docs/schema.sql" \
"CREATE TABLE example (id int);")
assert_exit "docs/*.sql → exit 0 (무시)" 0 "$result"

# ─── 엣지케이스 ─────────────────────────────────────────────────────────────

echo ""
echo "[ 엣지케이스 ]"

result=$(printf '' | bash "$HOOK" 2>/dev/null; echo $?)
assert_exit "빈 stdin → exit 0 (크래시 없음)" 0 "$result"

# CREATE TABLE이 주석 안에 있는 경우 (현재 구현은 단순 grep이므로 false positive 허용)
# 이건 알려진 한계로 문서화만 — 테스트 생략

# 공백/대소문자 혼합
result=$(run_hook "supabase/migrations/20240104_case.sql" \
"create table IF NOT EXISTS Notes (
  id uuid PRIMARY KEY
);
alter table notes enable row level security;")
assert_exit "대소문자 혼합 CREATE TABLE + RLS → exit 0" 0 "$result"

# ─── 결과 ────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "결과: ${PASS}개 통과 / ${FAIL}개 실패"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
