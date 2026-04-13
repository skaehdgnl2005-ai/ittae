#!/bin/bash
# .claude/hooks/rls-check.sh
# 마이그레이션 파일의 RLS 활성화 검증 — PostToolUse (Write|Edit)
#
# 동작: supabase/migrations/*.sql 파일에 CREATE TABLE이 있지만
#       ENABLE ROW LEVEL SECURITY가 없으면 exit 2로 차단
#
# 근거: RLS 누락은 프로덕션 보안 사고로 직결됨. 경고로 두지 않고 하드 차단.

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/lib.sh"

INPUT=$(cat)
FILE=$(extract_field "$INPUT" "tool_input.file_path")
[ -z "$FILE" ] && FILE=$(extract_field "$INPUT" "tool_input.path")

# supabase/migrations/*.sql 파일만 검사
case "$FILE" in
  *supabase/migrations/*.sql) ;;
  *) exit 0 ;;
esac

FULL_PATH="$CLAUDE_PROJECT_DIR/$FILE"
[ ! -f "$FULL_PATH" ] && exit 0

# CREATE TABLE이 없으면 검사 불필요 (정책 추가 파일 등)
if ! grep -qiE '^\s*CREATE\s+TABLE' "$FULL_PATH" 2>/dev/null; then
  exit 0
fi

# CREATE TABLE이 있는데 ENABLE ROW LEVEL SECURITY가 없으면 차단
if ! grep -qiE 'ENABLE\s+ROW\s+LEVEL\s+SECURITY' "$FULL_PATH" 2>/dev/null; then
  echo "🔒 [RLS 누락] 마이그레이션에 CREATE TABLE이 있지만 RLS가 활성화되지 않았습니다." >&2
  echo "" >&2
  echo "  파일: $FILE" >&2
  echo "" >&2
  echo "  각 CREATE TABLE 이후 반드시 추가하세요:" >&2
  echo "    ALTER TABLE <테이블명> ENABLE ROW LEVEL SECURITY;" >&2
  echo "" >&2
  echo "  그리고 최소 4개 정책을 작성하세요 ({table}_select_{role} 등)." >&2
  echo "  → docs/DATA_MODEL.md 'RLS 정책' 섹션 참조" >&2
  exit 2
fi

exit 0
