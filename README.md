# ittae (모임) — 친구들과 시간을 맞추고 장소를 고르는 소셜 스케줄링 웹앱

> A social scheduling web app: create a group, vote on time slots, invite guests by link (no sign-up), import timetables from Everytime screenshots, sync Google Calendar, pick a place on Kakao Maps. Next.js 16 + Supabase, deployed on Vercel. The `.claude/` harness that built it has tests for its own hooks.

**한 줄로**: "언제 볼까?"를 단톡방 대신 한 링크로 끝낸다. 모임을 만들고, 가능한 시간대에 투표하고, 비회원 친구는 초대 링크로 바로 투표하고, 확정되면 장소를 고른다.

## 무엇을 만들었나
- 모임 생성 → 시간대 투표(실시간 집계, Supabase Realtime) → 확정 → 장소 선택(Kakao Maps).
- **게스트 초대 링크**: 가입 없이 코드 링크로 투표(`src/app/api/invite/[code]/`).
- **에브리타임 시간표 가져오기**: 스크린샷을 Gemini로 파싱해 개인 일정으로 등록.
- **Google Calendar OAuth 연동**: 개인 일정 충돌 감지(`src/lib/schedule-conflict`).
- 친구 추가, 개인 일정 시트, 월/일 캘린더.
- API 라우트 20+ (`src/app/api/{groups,vote-sessions,invite,schedules,friends,everytime,google}`).

## 왜 이렇게 만들었나 (설계 결정)
- **RLS 누락을 사람이 아니라 스크립트가 잡는다.** 모든 Supabase 쿼리에 Row-Level Security를 적용하는 규칙을 `supabase/migrations/rls-check.sh`와 `.claude/hooks/rls-check.sh`가 강제한다. 새 테이블에 정책이 없으면 커밋 전에 막힌다.
- **하네스 4계층**(`HARNESS_README.md`): CLAUDE.md(정책, 확률적) → `.claude/rules/`(파일 경로별 조건부 컨텍스트) → `.claude/skills/`(절차) → `.claude/hooks/`(셸 스크립트로 100% 강제, exit 2 하드 스톱) → `.claude/agents/`(위임). "LLM이 안 지켜도 되는 것"과 "반드시 지켜야 하는 것"을 배치 위치로 구분했다.
- **훅에 훅의 테스트가 있다**(`.claude/hooks/tests/test_{design_guard,pre_bash,rls_check}.sh`). 강제 장치가 잘못 동작하면 개발 전체가 멈추므로, 강제 장치부터 테스트했다.
- **바이브 코딩 안티패턴 명시 금지**: `any` 금지, 인라인 스타일 금지, 컴포넌트 200줄 상한, `useEffect` 데이터 페칭 금지, 보라 그라데이션·글래스모피즘 금지(`docs/DESIGN_SYSTEM.md`).
- **기각한 것**: "추억 기록(memories)" 기능. 시연 범위를 좁히기 위해 마이그레이션 `010_drop_memories.sql`로 제거 중이다.

## 어떻게 검증했나
- Vitest 단위 테스트 9파일: 투표 집계, 일정 충돌, 초대 코드, 시간대 선택 훅 등.
- 훅 자체 테스트 3종(design-guard / pre-bash / rls-check).
- E2E와 CI는 없다. 배포 후 수동 시연 체크로 검증했다.

## 기술 스택
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Framer Motion · Supabase (Auth/Postgres/Realtime/Storage, `@supabase/ssr`) · Google Calendar API · Kakao Maps SDK · `@google/genai` · Vitest · pnpm · Vercel (icn1)

## 실행 방법
```bash
pnpm install
cp .env.example .env.local      # Supabase URL/anon key, Google OAuth, Kakao, Gemini
pnpm dev                        # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test
```

## 프로젝트 구조
```
src/app/(main)/        탭 레이아웃 (home, friends, create, map)
src/app/group/[id]/    모임 상세 / 투표
src/app/api/           groups · vote-sessions · invite · schedules · friends · everytime · google
src/components/        calendar · vote · map · layout · ui(shadcn)
src/lib/               supabase 헬퍼 · kakao 래퍼 · vote/conflict/invite 로직 (+ __tests__)
supabase/migrations/   001~010 + rls-check.sh
.claude/               rules · skills · hooks(+tests) · agents   ← 하네스
docs/                  SPEC · API · DATA_MODEL · DESIGN_SYSTEM · HANDOFF
```

## 상태
Vercel 배포된 시연용 MVP. 현재 브랜치에는 memories 기능 제거와 초대/투표 라우트 정리가 진행 중이다.
