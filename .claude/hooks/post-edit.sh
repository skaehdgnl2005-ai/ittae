#!/bin/bash
# .claude/hooks/post-edit.sh
# 파일 편집 후 자동 검증 — PostToolUse (Write|Edit)
#
# 동작: .ts/.tsx 파일 편집 시 typecheck + lint 실행
# 실패 시 stderr에 에러 출력 → Claude가 즉시 수정

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# .ts/.tsx 파일만 검증
if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  # typecheck (해당 파일만)
  ERRORS=$(cd "$CLAUDE_PROJECT_DIR" && pnpm typecheck 2>&1 | grep -E "error TS" | head -5)
  if [ -n "$ERRORS" ]; then
    echo "TypeScript 에러 발견:" >&2
    echo "$ERRORS" >&2
  fi

  # lint (해당 파일만)
  LINT=$(cd "$CLAUDE_PROJECT_DIR" && pnpm eslint "$FILE" --quiet 2>&1 | head -5)
  if [ $? -ne 0 ] && [ -n "$LINT" ]; then
    echo "ESLint 에러:" >&2
    echo "$LINT" >&2
  fi
fi

exit 0
