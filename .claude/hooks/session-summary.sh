#!/bin/bash
# .claude/hooks/session-summary.sh
# 세션 종료 시 변경 사항 요약 저장 — Stop

INPUT=$(cat)
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# 무한 루프 방지
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

SUMMARY_DIR="$CLAUDE_PROJECT_DIR/.claude/sessions"
mkdir -p "$SUMMARY_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SUMMARY_FILE="$SUMMARY_DIR/$TIMESTAMP.md"

# git diff로 변경 사항 수집
CHANGES=$(cd "$CLAUDE_PROJECT_DIR" && git diff --stat HEAD 2>/dev/null || echo "no git changes")
STAGED=$(cd "$CLAUDE_PROJECT_DIR" && git diff --cached --stat 2>/dev/null || echo "nothing staged")

cat > "$SUMMARY_FILE" << EOF
# Session $TIMESTAMP

## Changes
\`\`\`
$CHANGES
\`\`\`

## Staged
\`\`\`
$STAGED
\`\`\`
EOF

exit 0
