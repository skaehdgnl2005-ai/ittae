---
name: design-check
description: 완성된 화면의 디자인 일관성과 AI 안티패턴을 검증한다. 새 컴포넌트나 페이지 작성 완료 후 실행.
---

# 디자인 체크리스트

$ARGUMENTS에 해당하는 파일 또는 현재 작업 중인 화면을 검증한다.

## 1단계: docs/DESIGN_SYSTEM.md 읽기
디자인 시스템 문서를 읽고 아래 기준으로 검증한다.

## 2단계: AI 안티패턴 점검
대상 파일에서 다음을 검색한다:
- `grep -rn "gradient\|backdrop-filter\|glass" $FILE`
- `grep -rn "Inter\|Roboto\|Arial\|system-ui" $FILE`
- `grep -rn "bg-indigo\|text-indigo\|rounded-2xl\|rounded-3xl" $FILE`
- `grep -rn "neon\|glow" $FILE`

하나라도 발견되면 즉시 수정한다.

## 3단계: 토큰 일관성 점검
- 색상: violet-600 (CTA), gray-800 (텍스트), gray-50 (배경) 사용 확인
- 폰트: font-pretendard (본문), font-serif (숫자 강조) 확인
- 스페이싱: 4px 배수 확인 (p-3=12px, p-4=16px, gap-5=20px 등)
- border-radius: rounded-xl (카드), rounded-lg (버튼), rounded-full (아바타만)

## 4단계: 모바일 UX 점검
- 터치 타겟 44px 이상: `min-h-11 min-w-11` 또는 `h-12`, `h-13` 등
- 좌우 패딩 20px: `px-5`
- 하단 탭바 safe area: `pb-safe` 또는 `pb-[83px]`

## 5단계: 자가 점검 질문
"이 화면을 v0에 한 줄 프롬프트로 넣으면 비슷한 게 나올까?"
→ "예"이면 차별화 요소를 추가한다.
