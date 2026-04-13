---
globs:
  - "src/components/**/*.tsx"
  - "src/app/**/*.tsx"
alwaysApply: false
---

# 컴포넌트 작성 규칙

## 구조
- 한 파일에 하나의 export 컴포넌트. 유틸 함수는 별도 파일.
- Props는 컴포넌트 바로 위에 type으로 정의. interface 사용 금지.
- 기본값은 destructuring default로. defaultProps 사용 금지.

## 네이밍
- 컴포넌트: PascalCase (VoteMatrix, PlaceCard)
- 파일명: 컴포넌트명과 동일 (VoteMatrix.tsx)
- 훅: use 접두사 (useVoteSession)
- 이벤트 핸들러: handle 접두사 (handleVoteSubmit)

## Tailwind 패턴
- 조건부 클래스: `cn()` 유틸리티 사용 (lib/utils.ts)
- 반응형: 모바일 퍼스트 — 기본이 375px, `md:` 이상은 태블릿.
- 색상: 커스텀 팔레트만 (violet-600, gray-800 등). indigo 사용 금지.
- 다크모드: `dark:` 프리픽스로 모든 색상에 대응.

## 접근성
- 버튼/링크에 aria-label 필수 (아이콘만 있는 경우).
- 터치 타겟 최소 44x44px (min-h-11 min-w-11).
- 이미지에 alt 필수.
