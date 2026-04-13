#!/bin/bash
# .claude/hooks/tests/test_pre_bash.sh
# pre-bash.sh 단위 테스트

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../pre-bash.sh"

PASS=0
FAIL=0

run_hook() {
  local cmd="$1"
  printf '{"tool_input":{"command":"%s"}}' "$cmd" | bash "$HOOK" 2>/dev/null
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

# ─── 차단 케이스 (exit 2 기대) ───────────────────────────────────────────────

echo "[ 차단 케이스 — exit 2 기대 ]"

result=$(run_hook "rm -rf /")
assert_exit "rm -rf / → exit 2" 2 "$result"

result=$(run_hook "rm -rf ~")
assert_exit "rm -rf ~ → exit 2" 2 "$result"

result=$(run_hook "rm -rf ..")
assert_exit "rm -rf .. → exit 2" 2 "$result"

result=$(run_hook "rm -rf \$HOME")
assert_exit 'rm -rf $HOME → exit 2' 2 "$result"

result=$(run_hook "cat .env")
assert_exit "cat .env → exit 2" 2 "$result"

result=$(run_hook "cat .env.local")
assert_exit "cat .env.local → exit 2" 2 "$result"

result=$(run_hook "cp .env /tmp/stolen")
assert_exit "cp .env → exit 2" 2 "$result"

result=$(run_hook "git push --force origin main")
assert_exit "git push --force → exit 2" 2 "$result"

result=$(run_hook "git push -f origin main")
assert_exit "git push -f → exit 2" 2 "$result"

# ─── 허용 케이스 (exit 0 기대) ───────────────────────────────────────────────

echo ""
echo "[ 허용 케이스 — exit 0 기대 ]"

result=$(run_hook "git status")
assert_exit "git status → exit 0" 0 "$result"

result=$(run_hook "git push origin main")
assert_exit "git push (force 없음) → exit 0" 0 "$result"

result=$(run_hook "pnpm dev")
assert_exit "pnpm dev → exit 0" 0 "$result"

result=$(run_hook "pnpm typecheck")
assert_exit "pnpm typecheck → exit 0" 0 "$result"

result=$(run_hook "ls src/components")
assert_exit "ls → exit 0" 0 "$result"

result=$(run_hook "cat src/app/page.tsx")
assert_exit "cat 일반 파일 → exit 0" 0 "$result"

result=$(run_hook "supabase db push")
assert_exit "supabase db push → exit 0" 0 "$result"

# ─── 엣지케이스 ─────────────────────────────────────────────────────────────

echo ""
echo "[ 엣지케이스 ]"

result=$(printf '' | bash "$HOOK" 2>/dev/null; echo $?)
assert_exit "빈 stdin → exit 0 (크래시 없음)" 0 "$result"

# 커맨드에 공백 다수 포함
result=$(run_hook "git   push   --force")
assert_exit "공백 다수 git push --force → exit 2" 2 "$result"

# ─── 결과 ────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "결과: ${PASS}개 통과 / ${FAIL}개 실패"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
