# Moim 하네스 구조

이 문서는 Claude Code가 모임 앱을 올바르게 개발하도록 설계된
**에이전트 하네스의 전체 구조**를 설명한다.

---

## 핵심 원리: 4계층 분리

```
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE.md                                                  │
│  정책 (Policy)                                              │
│  "무엇이 옳은가" — 프로젝트 컨텍스트, 스택, 핵심 규칙       │
│  → Claude가 매 세션 시작 시 읽음. 150줄 이하 유지.          │
├─────────────────────────────────────────────────────────────┤
│  .claude/rules/                                             │
│  조건부 컨텍스트 (Conditional Context)                       │
│  "이 파일을 만질 때만 알면 되는 것"                          │
│  → globs 패턴으로 자동 로드. 불필요한 토큰 소비 방지.        │
├─────────────────────────────────────────────────────────────┤
│  .claude/skills/                                            │
│  절차 (Procedures)                                          │
│  "어떻게 하는가" — 반복되는 워크플로우를 /명령어로 실행      │
│  → Claude가 자동 인식하거나 사용자가 /skill-name으로 호출.   │
├─────────────────────────────────────────────────────────────┤
│  .claude/hooks/                                             │
│  강제 (Enforcement)                                         │
│  "반드시 이렇게 해야 한다" — 셸 스크립트로 100% 보장         │
│  → LLM 판단 우회. exit 2로 하드 스톱.                       │
├─────────────────────────────────────────────────────────────┤
│  .claude/agents/                                            │
│  위임 (Delegation)                                          │
│  "이 일은 전문가에게" — 별도 컨텍스트의 서브에이전트         │
│  → 메인 세션 오염 없이 병렬 작업.                           │
└─────────────────────────────────────────────────────────────┘
```

**배치 원칙:**
- LLM이 지켜도 되고 안 지켜도 되는 것 → CLAUDE.md (확률적)
- LLM이 반드시 100% 지켜야 하는 것 → Hooks (결정적)
- 파일 패턴에 따라 달라지는 것 → Rules (조건부)
- 반복되는 멀티스텝 작업 → Skills (절차적)
- 독립된 전문 분석 → Agents (격리됨)

---

## 디렉토리 구조

```
moim/
├── CLAUDE.md                          ← 최상위 정책 (150줄)
├── .claude/
│   ├── settings.json                  ← 퍼미션 + 훅 설정
│   ├── .gitignore                     ← 세션 로그 제외
│   │
│   ├── rules/                         ← 조건부 규칙 (globs 기반)
│   │   ├── components.md              ← .tsx 파일 작업 시 로드
│   │   ├── supabase.md                ← DB/API 작업 시 로드
│   │   └── kakao-maps.md             ← 지도 기능 작업 시 로드
│   │
│   ├── skills/                        ← 슬래시 명령어
│   │   ├── design-check/SKILL.md      ← /design-check: 디자인 검증
│   │   ├── component-gen/SKILL.md     ← /component: 컴포넌트 생성
│   │   └── vote-flow/SKILL.md         ← /vote-flow: 투표 기능 구현
│   │
│   ├── agents/                        ← 서브에이전트
│   │   ├── reviewer.md                ← 코드 리뷰 전문가
│   │   └── explorer.md               ← 코드베이스 탐색
│   │
│   ├── hooks/                         ← 결정적 강제 스크립트
│   │   ├── post-edit.sh               ← 편집 후 lint+typecheck
│   │   ├── design-guard.sh            ← AI 안티패턴 실시간 감지
│   │   ├── pre-bash.sh                ← 위험 명령어 차단
│   │   └── session-summary.sh         ← 세션 종료 요약 저장
│   │
│   └── sessions/                      ← 자동 생성 (gitignore)
│
└── docs/                              ← 참조 문서 (on-demand)
    ├── SPEC.md                        ← 기능 명세서
    ├── DESIGN_SYSTEM.md               ← 디자인 시스템
    ├── DATA_MODEL.md                  ← ERD + RLS
    └── API.md                         ← Kakao API 가이드
```

---

## 훅 동작 방식

### design-guard.sh (핵심 차별화)

이 훅은 `.tsx` 파일이 편집될 때마다 자동으로 실행되어
AI 바이브코딩의 흔적을 실시간으로 감지한다.

```
Claude가 .tsx 파일 작성
       ↓
  PostToolUse 이벤트 발생
       ↓
  design-guard.sh 실행
       ↓
  grep으로 안티패턴 검색:
  - gradient, backdrop-filter
  - Inter, Roboto, Arial
  - bg-indigo, rounded-2xl
  - neon, glow
       ↓
  발견 시 → stderr로 경고 메시지
       ↓
  Claude가 경고를 읽고 자동 수정
```

exit 0을 반환하므로 작업을 차단하지는 않지만,
stderr 피드백을 통해 Claude가 즉시 수정하도록 유도한다.

### pre-bash.sh (안전장치)

```
Claude가 bash 명령어 실행 시도
       ↓
  PreToolUse 이벤트 발생
       ↓
  pre-bash.sh 실행
       ↓
  위험 명령어 감지:
  - rm -rf /  → exit 2 (차단)
  - cat .env  → exit 2 (차단)
  - git push --force → exit 2 (차단)
       ↓
  안전한 명령어 → exit 0 (허용)
```

exit 2는 Claude Code가 존중하는 하드 스톱이다.
프롬프트와 달리 100% 보장된다.

---

## 사용법

### 일반 개발
```bash
claude  # 세션 시작 → CLAUDE.md 자동 로드
```
`.tsx` 파일 작업 시 `components.md` 규칙 자동 로드.
편집할 때마다 lint, typecheck, 디자인 가드 훅 자동 실행.

### 슬래시 명령어
```
/design-check src/components/vote/VoteMatrix.tsx
/component PlaceCard
/vote-flow
```

### 서브에이전트 활용
```
"reviewer 에이전트로 오늘 변경사항 리뷰해줘"
"explorer로 캘린더 관련 코드 구조 파악해줘"
```

---

## 확장 가이드

### 새 규칙 추가
`.claude/rules/`에 `.md` 파일 생성.
frontmatter에 `globs`와 `alwaysApply` 지정.

### 새 스킬 추가
`.claude/skills/{name}/SKILL.md` 생성.
`---` frontmatter에 name, description 필수.

### 새 훅 추가
1. `.claude/hooks/`에 `.sh` 스크립트 생성
2. `chmod +x` 실행 권한 부여
3. `.claude/settings.json`의 hooks 섹션에 등록

### 새 에이전트 추가
`.claude/agents/{name}.md` 생성.
frontmatter에 name, description, model, allowed-tools 지정.
