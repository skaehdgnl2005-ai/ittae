#!/bin/bash
# .claude/hooks/tests/test_design_guard.sh
# design-guard.sh 단위 테스트
#
# 실행: bash .claude/hooks/tests/test_design_guard.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../design-guard.sh"
TMPDIR_TEST=$(mktemp -d)
export CLAUDE_PROJECT_DIR="$TMPDIR_TEST"

PASS=0
FAIL=0

cleanup() { rm -rf "$TMPDIR_TEST"; }
trap cleanup EXIT

# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

run_hook() {
  local relpath="$1"
  local content="$2"
  local dir
  dir=$(dirname "$TMPDIR_TEST/$relpath")
  mkdir -p "$dir"
  echo "$content" > "$TMPDIR_TEST/$relpath"
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

assert_stderr_contains() {
  local desc="$1"
  local pattern="$2"
  local content="$3"
  if echo "$content" | grep -q "$pattern"; then
    echo "  ✓ $desc"
    ((PASS++))
  else
    echo "  ✗ $desc  (패턴 '$pattern' 없음)"
    ((FAIL++))
  fi
}

# ─── CRITICAL 패턴 (exit 2 기대) ────────────────────────────────────────────

echo "[ CRITICAL — exit 2 기대 ]"

result=$(run_hook "src/comp.tsx" "background: linear-gradient(to right, #7C3AED, #4F46E5);")
assert_exit "linear-gradient → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" "background: radial-gradient(circle, #fff, #000);")
assert_exit "radial-gradient → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" 'className="bg-gradient-to-r from-violet-600"')
assert_exit "bg-gradient Tailwind → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" "font-family: Inter, sans-serif;")
assert_exit "Inter 폰트 → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" "font-family: Roboto, sans-serif;")
assert_exit "Roboto 폰트 → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" "font-family: Arial, sans-serif;")
assert_exit "Arial 폰트 → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" "font-family: system-ui, sans-serif;")
assert_exit "system-ui 폰트 → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" "backdrop-filter: blur(10px);")
assert_exit "backdrop-filter → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" 'className="backdrop-blur-md bg-white/30"')
assert_exit "backdrop-blur Tailwind → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" 'className="bg-indigo-500 text-white"')
assert_exit "bg-indigo → exit 2" 2 "$result"

result=$(run_hook "src/comp.tsx" 'className="text-indigo-600"')
assert_exit "text-indigo → exit 2" 2 "$result"

# ─── WARNING 패턴 (exit 0 기대, stderr에 경고) ───────────────────────────────

echo ""
echo "[ WARNING — exit 0 기대 ]"

result=$(run_hook "src/comp.tsx" 'className="rounded-2xl p-4"')
assert_exit "rounded-2xl → exit 0 (경고만)" 0 "$result"

result=$(run_hook "src/comp.tsx" 'className="rounded-3xl"')
assert_exit "rounded-3xl → exit 0 (경고만)" 0 "$result"

# 아바타 컨텍스트에서 rounded-full 허용
result=$(run_hook "src/Avatar.tsx" 'const Avatar = () => <img className="rounded-full w-8 h-8" />')
assert_exit "Avatar 파일의 rounded-full → exit 0 (허용)" 0 "$result"

# ─── STDERR 메시지 검증 ──────────────────────────────────────────────────────

echo ""
echo "[ STDERR 경고 메시지 검증 ]"

stderr_out=$(
  printf '{"tool_input":{"file_path":"src/comp.tsx"}}' \
  | bash "$HOOK" 2>&1 1>/dev/null <<< "" \
  || true
)

# linear-gradient에 대해 stderr에 "그라데이션" 포함 여부
TMPFILE="$TMPDIR_TEST/src/warn_test.tsx"
mkdir -p "$(dirname "$TMPFILE")"
echo "background: linear-gradient(to right, #fff, #000);" > "$TMPFILE"
STDERR_OUT=$(printf '{"tool_input":{"file_path":"src/warn_test.tsx"}}' | bash "$HOOK" 2>&1 >/dev/null)
assert_stderr_contains "그라데이션 차단 시 stderr에 메시지 포함" "CRITICAL\|그라데이션\|gradient" "$STDERR_OUT"

# ─── 무시 케이스 (exit 0 기대) ───────────────────────────────────────────────

echo ""
echo "[ 무시 케이스 — exit 0 기대 ]"

result=$(run_hook "README.md" "## linear-gradient example in docs")
assert_exit ".md 파일 무시 → exit 0" 0 "$result"

result=$(run_hook "src/component.tsx" "const title = 'Hello, world!'; // no violations")
assert_exit "위반 없는 TSX → exit 0" 0 "$result"

result=$(run_hook "src/styles.css" ".btn { color: var(--violet-600); }")
assert_exit "위반 없는 CSS → exit 0" 0 "$result"

# ─── jq 없는 환경 시뮬레이션 ─────────────────────────────────────────────────

echo ""
echo "[ 엣지케이스 ]"

# 빈 입력 → crash 없이 exit 0
result=$(printf '' | bash "$HOOK" 2>/dev/null; echo $?)
assert_exit "빈 stdin 입력 → exit 0 (크래시 없음)" 0 "$result"

# 파일 경로에 공백 포함
result=$(run_hook "src/my component.tsx" "const x = 1;")
assert_exit "파일 경로 공백 포함 → exit 0 (크래시 없음)" 0 "$result"

# ─── 결과 ────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "결과: ${PASS}개 통과 / ${FAIL}개 실패"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
