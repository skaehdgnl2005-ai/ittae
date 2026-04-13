#!/bin/bash
# .claude/hooks/lib.sh
# 공통 유틸리티 — 각 훅에서 source 해서 사용
#
# 사용법:
#   HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$HOOK_DIR/lib.sh"

# JSON 필드 추출 (jq → node 순으로 시도)
#
# 인자:
#   $1 — JSON 문자열
#   $2 — 점(.) 구분 경로, 선두 점 생략 (예: "tool_input.file_path")
#
# 출력: 필드 값 (없으면 빈 문자열)
extract_field() {
  local json="$1"
  local path="$2"

  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".${path} // empty" 2>/dev/null
  elif command -v node &>/dev/null; then
    echo "$json" | node -e "
      let d = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => {
        try {
          let v = JSON.parse(d);
          '${path}'.split('.').forEach(k => { v = v && v[k]; });
          process.stdout.write(String(v || ''));
        } catch (e) {}
      });
    " 2>/dev/null
  fi
}
