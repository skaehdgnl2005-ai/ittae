#!/bin/bash
# .claude/hooks/design-guard.sh
# AI 바이브코딩 안티패턴 자동 감지 — PostToolUse (Write|Edit)
#
# CRITICAL 패턴 (절대 금지): exit 2 — 하드 차단
#   - 그라데이션, 금지 폰트(Inter/Roboto/Arial/system-ui), 글래스모피즘, bg-indigo
#
# WARNING 패턴 (주의 필요): exit 0 — stderr 경고만
#   - 과도한 border-radius (아바타 컨텍스트 제외)

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOK_DIR/lib.sh"

INPUT=$(cat)
FILE=$(extract_field "$INPUT" "tool_input.file_path")
[ -z "$FILE" ] && FILE=$(extract_field "$INPUT" "tool_input.path")

# CSS/TSX/TS 파일만 검사
if [[ "$FILE" != *.tsx && "$FILE" != *.css && "$FILE" != *.ts ]]; then
  exit 0
fi

FULL_PATH="$CLAUDE_PROJECT_DIR/$FILE"
[ ! -f "$FULL_PATH" ] && exit 0

CRITICAL=""
WARNINGS=""

# ── CRITICAL: 그라데이션 ──────────────────────────────────────────────────────
if grep -qiE "(linear-gradient|radial-gradient|bg-gradient)" "$FULL_PATH" 2>/dev/null; then
  CRITICAL+="[CRITICAL] 그라데이션 사용 금지. 단색(solid)만 허용됩니다.\n"
  CRITICAL+="  → bg-violet-600, bg-gray-50 등 단색 클래스 사용\n"
fi

# ── CRITICAL: 금지 폰트 ───────────────────────────────────────────────────────
if grep -qiE "font-family[^;]*\b(Inter|Roboto|Arial|system-ui)\b" "$FULL_PATH" 2>/dev/null; then
  CRITICAL+="[CRITICAL] 금지 폰트 감지 (Inter/Roboto/Arial/system-ui).\n"
  CRITICAL+="  → Pretendard Variable (본문), Instrument Serif (숫자 강조) 사용\n"
fi

# ── CRITICAL: 글래스모피즘 ───────────────────────────────────────────────────
if grep -qiE "(backdrop-filter|backdrop-blur)" "$FULL_PATH" 2>/dev/null; then
  CRITICAL+="[CRITICAL] 글래스모피즘 사용 금지 (backdrop-filter/backdrop-blur).\n"
  CRITICAL+="  → 불투명 흰색 카드 + 1px border 사용 (bg-white border border-gray-200)\n"
fi

# ── CRITICAL: Tailwind 기본 indigo ────────────────────────────────────────────
if grep -qE "\b(bg|text|border|ring|from|to|via)-indigo-" "$FULL_PATH" 2>/dev/null; then
  CRITICAL+="[CRITICAL] Tailwind 기본 indigo 사용 금지 (bg-indigo-500 등).\n"
  CRITICAL+="  → 커스텀 violet 팔레트 사용 (violet-600이 Primary CTA)\n"
fi

# ── WARNING: 과도한 border-radius ────────────────────────────────────────────
if grep -qE "\brounded-(2xl|3xl)\b" "$FULL_PATH" 2>/dev/null; then
  WARNINGS+="[WARNING] rounded-2xl 이상 사용 주의.\n"
  WARNINGS+="  → 카드: rounded-xl(12px), 버튼: rounded-lg(8px), 아바타만 rounded-full\n"
fi

# ─── 출력 ─────────────────────────────────────────────────────────────────────

if [ -n "$CRITICAL" ]; then
  echo -e "🚫 CRITICAL 디자인 위반 — 즉시 수정 필요 ($FILE):" >&2
  echo -e "$CRITICAL" >&2
  echo "→ docs/DESIGN_SYSTEM.md '안티패턴 금지 목록' 참조" >&2
  exit 2
fi

if [ -n "$WARNINGS" ]; then
  echo -e "⚠️  디자인 경고 ($FILE):" >&2
  echo -e "$WARNINGS" >&2
  echo "→ docs/DESIGN_SYSTEM.md를 확인하고 수정하세요." >&2
fi

exit 0
