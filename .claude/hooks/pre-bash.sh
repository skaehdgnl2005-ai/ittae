#!/bin/bash
# .claude/hooks/pre-bash.sh
# 위험한 bash 명령어 차단 — PreToolUse (Bash)
#
# exit 2 = 실행 차단 (Claude Code가 존중하는 하드 스톱)
# exit 0 = 실행 허용

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/lib.sh"

INPUT=$(cat)
CMD=$(extract_field "$INPUT" "tool_input.command")

# 입력이 없으면 허용
[ -z "$CMD" ] && exit 0

# ── 파괴적 삭제 차단 ─────────────────────────────────────────────────────────
if echo "$CMD" | grep -qE "rm\s+-rf\s+(/|~|\.\.|\\$)" ; then
  echo "위험: 재귀적 삭제 명령어가 차단되었습니다." >&2
  exit 2
fi

# ── .env 파일 접근 차단 ───────────────────────────────────────────────────────
if echo "$CMD" | grep -qE "(cat|less|more|cp|mv|echo)\s+.*\.env" ; then
  echo "보안: .env 파일 접근이 차단되었습니다." >&2
  exit 2
fi

# ── git force push 차단 ───────────────────────────────────────────────────────
if echo "$CMD" | grep -qE "git\s+push\s.*(-f\b|--force\b)" ; then
  echo "안전: force push가 차단되었습니다." >&2
  exit 2
fi

exit 0
