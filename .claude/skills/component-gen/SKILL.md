---
name: component
description: 새 UI 컴포넌트를 디자인 시스템에 맞게 생성한다. 컴포넌트명을 인자로 전달한다.
---

# 컴포넌트 생성: $ARGUMENTS

## 1단계: 디자인 시스템 확인
docs/DESIGN_SYSTEM.md에서 해당 컴포넌트 유형의 규격을 확인한다.
- 컬러 토큰, 스페이싱, border-radius, 타이포그래피 스케일

## 2단계: 파일 생성
```
src/components/{domain}/{ComponentName}.tsx
```
- domain: calendar, vote, map, layout, ui 중 적합한 것
- 한 파일에 하나의 default export

## 3단계: 구현 규칙
```typescript
"use client"; // 인터랙션이 있을 때만

import { cn } from "@/lib/utils";

type {ComponentName}Props = {
  // Props 정의
};

export default function {ComponentName}({ ...props }: {ComponentName}Props) {
  return (
    // Tailwind 클래스만 사용
    // 커스텀 violet/gray 팔레트
    // 모바일 퍼스트 (375px 기준)
  );
}
```

## 4단계: 검증
1. `pnpm typecheck` — 타입 에러 없음
2. `pnpm lint` — 린트 통과
3. `/design-check {파일경로}` — 디자인 일관성 확인

## 금지 사항
- styled-components, CSS modules, 인라인 스타일
- any 타입
- index.ts 배럴 파일 (직접 import)
