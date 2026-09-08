# Moim — 소셜 스케줄링 웹앱

친구들과 일정을 맞추고, 장소를 고르고, 추억을 기록하는 올인원 모임 앱.
심사위원 시연용 MVP. 타겟: 20\~30대 한국 사용자.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Framer Motion
Supabase (Auth, PostgreSQL, Realtime, Storage) · Kakao Maps SDK · Vercel

## Commands

```bash
pnpm dev            # localhost:3000
pnpm build          # 프로덕션 빌드
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest
pnpm db:types       # Supabase → TS 타입 생성
```

## Architecture

```
src/app/(main)/     → 탭 레이아웃 (home, friends, create, map, history)
src/app/group/\\\\\\\[id]/ → 모임 상세/투표
src/components/ui/  → shadcn/ui 공용
src/components/     → 도메인별 (calendar, vote, map, layout)
src/lib/supabase/   → 서버/클라이언트 헬퍼
src/lib/kakao/      → SDK 래퍼
src/hooks/          → 커스텀 훅
```

## Critical rules

* 모든 Supabase 쿼리에 RLS 적용. 예외 없음.
* `.env.local`은 커밋 금지. `NEXT\\\\\\\_PUBLIC\\\\\\\_` 접두사는 Supabase URL/anon key만.
* 서버 컴포넌트 기본. 인터랙션 필요 시만 `"use client"`.
* `any` 타입 금지.
* 인라인 스타일 금지 — Tailwind 전용.
* `useEffect` 데이터 페칭 금지 — 서버 컴포넌트 또는 React Query.
* 컴포넌트 파일 200줄 초과 금지.
* 작업 완료 후 `pnpm typecheck \\\\\\\&\\\\\\\& pnpm lint` 실행.
* DB 스키마 변경 시 마이그레이션 + `pnpm db:types`.

## Design policy

이 프로젝트는 AI 바이브코딩 안티패턴을 명시적으로 회피한다.
디자인 의사결정 전 반드시 `docs/DESIGN\\\\\\\_SYSTEM.md`를 읽는다.

절대 사용 금지:

* 보라색 그라데이션, 글래스모피즘, 네온 효과
* Inter, Roboto, system-ui 폰트
* 3열 아이콘 그리드, 히어로 섹션 패턴
* 20px 이상 border-radius (12px 카드, 8px 버튼, 50% 아바타만)
* bg-indigo-500 (Tailwind 기본 보라)

필수 사용: Pretendard (본문), Instrument Serif (숫자 강조), 커스텀 Violet 팔레트.

## Demo scenario

MVP 핵심 플로우: 홈 → 친구 선택 → 모임 생성 → 투표 → 확정 → 지도 장소 → 카톡 공유.
이 플로우가 끊김 없이 동작하는 것이 최우선 목표.

## Reference docs (on-demand)

* `docs/SPEC.md` — 화면별 기능 명세 (기능 ID 포함)
* `docs/DESIGN\\\\\\\_SYSTEM.md` — 컬러, 타이포, 스페이싱, 컴포넌트 규격
* `docs/DATA\\\\\\\_MODEL.md` — ERD, RLS 정책
* `docs/API.md` — Kakao API 연동

