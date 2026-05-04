# 에브리타임 시간표 OCR 인수인계 (2026-05-01)

다음 세션에서 이 문서 + spec + plan 셋만 읽으면 바로 구현 시작 가능.

## 한 줄 요약

홈 캘린더에서 에브리타임 시간표 스크린샷 한 장으로 학기 전체 수업을 personal 일정에 자동 추가. 비전 모델은 **Gemini 2.5 Flash**, 그룹 키는 **`(title, location)` → `everytime_class_id` uuid**, 펼치기는 **eager expand + RPC 단일 트랜잭션**.

## 산출물 (둘 다 master에 commit 됨)

- 📄 [Spec](../specs/2026-05-01-everytime-ocr-design.md) — `2026-05-01-everytime-ocr-design.md`
  - 모든 결정 사항, 데이터 모델, API 스펙, 보안, 테스트 전략
- 📄 [Plan](../plans/2026-05-01-everytime-ocr.md) — `2026-05-01-everytime-ocr.md`
  - 11개 task로 분해, 각 step에 실제 코드 포함
  - TDD: Task 5는 단위 테스트 9개 우선 작성

관련 commit:
- `f5f5c895` — 초안 spec
- `d167914e` — 리뷰 피드백 11개 항목 반영
- `eb6fb5bf` — implementation plan

## 핵심 결정 요약 (다시 합의 필요 X)

| 항목 | 결정 |
|---|---|
| OCR 엔진 | Gemini 2.5 Flash (`@google/genai`), structured output (responseSchema + enum) |
| 반복 모델 | Eager expand (학기 전체 row 펼침) + `everytime_class_id` 그룹 키 |
| 그룹 키 자연키 | `(title, location)` |
| 학기 디폴트 | 고려대 2026 1학기 (3/2~6/19), 2학기 (9/1~12/18) — **Task 0에서 학사력 한 번 더 확인** |
| 재업로드 | replace-all (기존 everytime row 전체 삭제 후 재펼침) — RPC로 단일 트랜잭션 |
| 미리보기 게이트 | 필수 (체크박스 + 인라인 편집), location null은 ⚠ 트리거 X |
| 진입점 | 홈 페이지 `GoogleConnectButton` 옆 `EverytimeImportButton` |
| 환경변수 | `GEMINI_API_KEY` (서버 전용) |
| sanity cap | 30 entries 초과 시 422 |

## 다음 세션에서 해야 할 일 (순서대로)

### 진행 전략: "build first, API last"
사용자 요청에 따라 **API 키는 맨 마지막에 넣음**. 코드 구조/UI/단위 테스트/typecheck/lint를 모두 끝낸 뒤, 마지막 단계에서 GEMINI_API_KEY를 발급해 PoC + 수동 QA를 한 번에 진행.

**즉, 다음 세션 시작 시점에 API 키 없어도 OK.** Task 1~10까지는 Gemini 호출 없이 모두 작성/검증 가능. Task 0의 env 설정과 Task 6의 PoC는 Task 10 완료 후로 미룸.

### 사전 준비 (다음 세션 시작 전)
**필수:** 없음 (코드 작업만 먼저 진행).

**Task 0 (학사력 확인)만 다음 세션 시작 시점에 처리** — [등록처 학사일정](https://registrar.korea.ac.kr/)에서 1·2학기 시작/종료일 확인하면 됨.

### 막판에 본인이 해야 할 것 (Task 10 완료 후)
1. **Gemini API 키 발급** — [Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료 키 발급, `.env.local`에 `GEMINI_API_KEY=...` 추가
2. **에브리타임 시간표 스크린샷 1~2장 준비** — `scratch/timetable-sample.jpg` 같은 경로 (gitignore)
3. 그다음 Task 6의 PoC + Task 11의 수동 QA 한 번에 진행

### 실행
**superpowers:subagent-driven-development** 스킬로 plan을 task-by-task 실행. plan 파일 자체에 fresh subagent가 읽고 진행할 수 있도록 모든 코드/명령이 포함되어 있음. 사용자(인간 검토자)는 task 사이마다 결과만 확인.

**Task 순서 조정 (build-first):**
- Task 0 → 학사력 확인만 진행, env var 추가는 SKIP
- Task 1~5 → 정상 진행 (마이그레이션, 타입, expand 단위 테스트)
- Task 6 → 클라이언트 코드는 작성하되 **step 3 (PoC)는 SKIP**, "API 키 들어오면 검증 예정" 코멘트만
- Task 7~10 → 정상 진행 (Gemini 호출 없이 typecheck/lint로만 검증)
- Task 0 step 3-4 + Task 6 step 3 + Task 11 → 사용자가 API 키 발급 후 한 묶음으로

## 다음 세션에서 첫 메시지로 붙여넣을 프롬프트

````
새 세션이야. 지난 세션에서 에브리타임 시간표 OCR 기능을 설계하고 implementation plan까지
완성했고, 이번 세션에서 subagent-driven으로 구현할 차례야.

핵심 산출물 세 개:
- docs/superpowers/handoffs/2026-05-01-everytime-ocr-handoff.md  (인수인계 — 가장 먼저 읽기)
- docs/superpowers/specs/2026-05-01-everytime-ocr-design.md      (spec)
- docs/superpowers/plans/2026-05-01-everytime-ocr.md             (11-task plan)

진행 전략은 "build first, API last" — 코드 골조부터 다 짠 뒤 마지막에 API 키 넣고
PoC + 수동 QA를 한꺼번에. 즉 GEMINI_API_KEY는 지금 없어도 되고, Task 1~10까지
Gemini 호출 없이 모두 작성·검증 가능.

순서:
1. handoff 문서를 먼저 읽고 현재 상태/결정사항/순서 조정 사항 파악
2. spec과 plan 훑으면서 일관성 빠르게 확인
3. superpowers:subagent-driven-development 스킬로 plan을 task-by-task 실행
   - Task 0: 학사력 확인만 진행 (env var 추가 SKIP)
   - Task 1~5: 정상 진행
   - Task 6: 클라이언트 코드만 작성, step 3 (PoC) SKIP
   - Task 7~10: 정상 진행 (typecheck/lint로만 검증)
   - Task 11: 일단 SKIP — 내가 API 키 발급한 다음 다시 알려줄게

각 task 끝날 때마다 결과 보여주고 다음 task 진행해도 될지 물어봐. Task 0의
"고려대 학사력 확인"은 내가 직접 확인하고 알려줄게.
````

## 주의사항 / 알려진 트랩

1. **Sheet 컴포넌트 200줄 제약** — `EverytimeImportSheet.tsx`가 250줄 정도 나올 가능성 큼. 분리할지 여부는 plan Task 9 step 2에 명시. 실용성 판단.
2. **`new Date('YYYY-MM-DD')` 금지** — UTC로 해석돼서 KST 환경에서 1일 어긋남. plan Task 5의 `parseLocalDate` 패턴 사용. 단위 테스트가 이미 KST 케이스 커버 중.
3. **RPC 타입 — `pnpm db:types` 필수** — Task 1에서 마이그레이션 적용 후 반드시 실행. 안 하면 Task 8에서 `supabase.rpc("replace_everytime_schedules", ...)` 타입 에러.
4. **`@google/genai` import 경로** — 신 SDK는 `import { GoogleGenAI, Type } from "@google/genai"`. 구 SDK(`@google/generative-ai`)와 헷갈리지 말 것.
5. **시연 토스트 컴포넌트 부재** — 현재 디자인 시스템에 토스트가 없으면 plan Task 9는 임시로 `alert()`로 처리. 디자인 시스템 컨벤션과 충돌하면 시연 직전에 간단 토스트 컴포넌트 추가.

## 완료 조건

Task 11의 시연 시나리오 1~10이 끊김 없이 동작:
1. 카카오 로그인 → 홈
2. 진입 버튼 → 시트 → 1학기 디폴트 + 스샷 업로드
3. 분석 로딩 → 5~6과목 검출
4. 한 과목 체크 해제, 한 과목 시간 인라인 수정
5. "X개 추가" → alert + 시트 닫힘
6. 캘린더에서 매주 반복 일정 확인
7. 진입 버튼 라벨이 "다시 가져오기"로 변경
8. 새 스샷 업로드 → "기존 N개 교체됩니다" amber 안내
9. 저장 → 기존 일정 교체 확인
10. 5MB 초과 / 시간표 아닌 이미지 등 에러 시나리오 토스트 동작
