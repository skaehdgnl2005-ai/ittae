# 에브리타임 시간표 OCR 가져오기 설계 (2026-05-01)

## 배경

홈 화면(`/home`)의 캘린더는 (a) 직접 추가한 personal 일정과 (b) 연결된 Google 캘린더 일정을 보여준다. 그러나 한국 대학생의 가장 안정적인 반복 일정인 **수업 시간표**가 빠져 있다. 학생들은 보통 에브리타임 앱에서 시간표를 짜고, 별도 캘린더 앱에 옮길 때 한 칸씩 직접 입력해야 한다.

이 작업은 **에브리타임 시간표 스크린샷 한 장**을 비전 LLM으로 인식해서, 학기 전 기간에 걸쳐 매주 반복되는 personal 일정으로 자동 추가한다. Google 캘린더 연동 옆에 진입점이 위치하며, 같은 `schedules` 테이블에 `source='everytime'`으로 저장된다.

## 결정 사항

### 인식 엔진
- **Gemini 2.5 Flash** (Google AI). `@google/generative-ai` SDK 사용.
- `responseMimeType: "application/json"` + `responseSchema`로 구조화 출력 강제.
- 환경변수 `GEMINI_API_KEY` (서버 전용, `NEXT_PUBLIC_` 접두사 사용 금지).
- 이미지 1장당 비용 ~$0.001, 시연 단계 비용 무시 가능.
- 한국어 OCR 정확도와 격자 레이아웃 이해가 우수해서 별도 후처리 휴리스틱 불필요.

### 반복 일정 모델
- **Eager expand + 그룹 키** 방식. 학기 범위 안의 매주 같은 요일·시간으로 개별 row를 만든다.
- 같은 과목에서 펼쳐진 row들은 `everytime_class_id` (uuid) 컬럼을 공유한다.
- "자료구조만 삭제" / "에브리타임 일정 전체 삭제" 둘 다 한 줄 쿼리.
- 현재 `schedules` 스키마(단일 `date` 컬럼)와 캘린더 렌더링 코드를 그대로 재사용.

### 학기 범위 입력
- **고려대 2026 학사 일정 디폴트** + 사용자 수정 허용.
  - 1학기: `2026-03-02` ~ `2026-06-19`
  - 2학기: `2026-09-01` ~ `2026-12-18`
- 시트 step 1에서 라디오 (1학기 / 2학기 / 직접 선택). 직접 선택 시 `<input type="date">` 두 개로 시작/종료 입력.
- 학교별 학사 일정 자동 매핑은 범위 외(고려대만 디폴트, 다른 학교 학생은 직접 선택).

### 재업로드 정책
- 새 스크린샷을 import 할 때마다 **사용자의 `source='everytime'` 일정을 모두 삭제 후 다시 펼침**(replace).
- 학기 중간 시간표 변경 시 한 번에 갱신. partial update / merge 없음.
- 원자성: Supabase JS 클라이언트는 트랜잭션이 없으므로, **Postgres 함수**(`replace_everytime_schedules(user_id, payloads jsonb)`)로 wrapping해서 delete + insert를 단일 RPC로 처리. 함수 내부는 자연스럽게 한 트랜잭션. RLS는 `security invoker`로 두고 함수 본문에서 `auth.uid() = user_id` 체크.

### 미리보기 / 편집
- LLM 분석 직후 **저장 전** 미리보기 단계 필수. OCR이 100%가 아니므로 사용자 검증 게이트.
- 표 형태로 모든 검출 클래스 표시: `[체크박스] 과목명  요일 시간  장소`
- 행 탭 → 인라인 수정(제목/요일/시작/종료/장소).
- 체크 해제 시 그 과목 제외.
- 시간/요일/제목 누락된 행은 ⚠ 표시 + 수정 전까지 체크 비활성.
- 하단 "X개 추가" 버튼이 활성화된(체크된) 클래스만 import.

### 충돌 처리
- 같은 시간대에 manual / google 일정과 겹쳐도 **그냥 추가**한다. 별도 row로 공존하고, 캘린더 UI는 이미 동시간대 일정 표시 가능.
- "이미 자료구조 있음 — 건너뛸까요" 같은 dedup 다이얼로그 없음(YAGNI).

### 오류 처리
- LLM 호출 실패, JSON 파싱 실패, 0개 검출 → 토스트 "시간표를 인식할 수 없었어요. 더 선명한 사진으로 다시 시도해주세요"
- 5MB 초과 / 비-jpeg/png → 클라이언트단에서 차단 + 토스트 "5MB 이하 이미지(jpg/png)만 지원해요"
- 부분 실패(예: 8개 중 1개 시간 파싱 실패)는 미리보기 단계에서 ⚠로 노출 → 사용자 결정.

### 진입점
- **홈 화면**의 `GoogleConnectButton` 바로 옆에 `EverytimeImportButton` 배치.
- 라벨: "에브리타임 시간표 가져오기".
- Google 연결 여부와 무관하게 항상 표시.

### 빠지는 것 (YAGNI)
- 동일 이미지 분석 결과 캐싱
- 학교별 학사 일정 자동 매핑(고려대만)
- 시간표 사진 영구 저장 (분석 후 폐기, DB·Storage 저장 X)
- 공휴일 / 시험기간 자동 제외 (학생이 개별 row 삭제로 처리)
- 재시험·보강·휴강 등 학사 이벤트 반영
- 시간표 변경 알림 / Google 캘린더로 push

## 데이터 모델

### `schedules` 컬럼·제약 변경

마이그레이션 `007_everytime_import.sql`:

```sql
-- 1. source check 제약에 'everytime' 추가
alter table schedules drop constraint if exists schedules_source_check;
alter table schedules add constraint schedules_source_check
  check (source in ('manual', 'google', 'everytime'));

-- 2. 같은 과목에서 펼쳐진 row들을 묶는 그룹 키
alter table schedules add column everytime_class_id uuid;

-- 3. 사용자별 everytime 일정 일괄 조회/삭제용 인덱스
create index schedules_everytime_idx
  on schedules(user_id, everytime_class_id)
  where source = 'everytime';

-- 4. delete-then-insert 원자성용 RPC
create or replace function replace_everytime_schedules(
  p_user_id uuid,
  p_payloads jsonb
) returns int
language plpgsql
security invoker
as $$
declare
  v_inserted int;
begin
  if auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  delete from schedules where user_id = p_user_id and source = 'everytime';

  insert into schedules (user_id, title, date, start_time, end_time, memo, source, everytime_class_id)
  select
    p_user_id,
    (p->>'title')::text,
    (p->>'date')::date,
    (p->>'start_time')::time,
    (p->>'end_time')::time,
    nullif(p->>'memo', ''),
    'everytime',
    (p->>'everytime_class_id')::uuid
  from jsonb_array_elements(p_payloads) p;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
```

- `everytime_class_id`: 한 과목(예: "자료구조")에서 펼쳐진 모든 주차 row가 공유하는 uuid. import 시점에 클래스마다 새로 생성. NULL이면 에브리타임 출처 아님.
- 기존 `schedules_all_self` RLS 정책이 `auth.uid() = user_id`이므로 `source='everytime'` row도 자동 커버. 별도 정책 불필요.

### Insert payload 형태

```ts
{
  user_id: string,           // auth user id
  title: string,             // 과목명
  date: string,              // 'YYYY-MM-DD' (특정 주차의 해당 요일 날짜)
  start_time: string,        // 'HH:MM'
  end_time: string,          // 'HH:MM'
  memo: string | null,       // 장소 (있으면)
  source: 'everytime',
  everytime_class_id: string // uuid, 같은 과목 row끼리 동일
}
```

## API

### `POST /api/everytime/parse`

Gemini 호출만 하고 DB는 건드리지 않음. 미리보기용.

**요청**: `multipart/form-data` `image` 필드 (jpg/png, ≤5MB)

**응답**:
```ts
{
  classes: Array<{
    title: string,
    dayOfWeek: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN',
    startTime: string,   // 'HH:MM'
    endTime: string,     // 'HH:MM'
    location: string | null
  }>
}
```

**에러**:
- `400`: 이미지 누락 / 지원 안 되는 형식
- `413`: 5MB 초과
- `502`: Gemini 호출 실패
- `422`: Gemini 응답 파싱 실패 또는 0개 검출

### `POST /api/everytime/import`

확정된 클래스 목록 + 학기 범위 받아서 펼친 후 `schedules`에 insert. 내부적으로 `replace_everytime_schedules` RPC를 호출해 기존 `source='everytime'` row 삭제 → 새 row insert를 단일 트랜잭션으로 수행.

**요청**:
```ts
{
  classes: Array<{
    title: string,
    dayOfWeek: 'MON' | ... | 'SUN',
    startTime: string,
    endTime: string,
    location: string | null
  }>,
  semesterStart: string,   // 'YYYY-MM-DD'
  semesterEnd: string      // 'YYYY-MM-DD'
}
```

**응답**: `{ data: { insertedCount: number, classCount: number } }`

**에러**:
- `400`: 잘못된 입력 (날짜 역전, classes 빈 배열, 시간 형식 오류)
- `500`: DB 오류

### `DELETE /api/everytime/import`

사용자의 `source='everytime'` 일정 전체 삭제. 설정 화면 / 시트의 "에브리타임 시간표 전체 삭제" 버튼에서 호출.

**응답**: `{ data: { deletedCount: number } }`

## 컴포넌트 구조

### `src/components/calendar/EverytimeImportButton.tsx`
- `GoogleConnectButton` 옆에 배치되는 진입 버튼.
- 클릭 시 `EverytimeImportSheet` 오픈.
- 사용자에게 이미 everytime 일정이 있으면 라벨이 "에브리타임 시간표 다시 가져오기"로 변경.

### `src/components/calendar/EverytimeImportSheet.tsx`
4-step state machine, 한 컴포넌트 내부에서 step 전환:

1. **upload**: 학기 프리셋 라디오 + 이미지 업로드 input. 이미지 선택되면 자동으로 step 2 전환.
2. **analyzing**: 스피너 + "시간표 읽는 중…" + 취소 버튼. 백그라운드에서 `POST /api/everytime/parse` 호출.
3. **preview**: 분석된 classes 리스트. 체크박스 + 인라인 편집. 하단 "X개 추가" 버튼.
4. **done**: 토스트 후 시트 닫기.

200줄 초과 시 `EverytimeUploadStep`, `EverytimePreviewStep`로 분리.

### `src/lib/gemini/client.ts`
- `@google/generative-ai` 래퍼. `getGeminiClient()` 함수로 싱글톤 반환.
- `parseTimetableImage(buffer: Buffer, mimeType: string): Promise<ParsedClass[]>` 노출.
- 프롬프트는 `src/lib/gemini/prompts/everytime.ts`에 별도 분리.
- `responseSchema`로 JSON 구조 강제.

### `src/lib/everytime/expand.ts` (순수 함수)
- `expandClasses({ classes, semesterStart, semesterEnd, userId }): InsertPayload[]`
- 각 class에 새 uuid `everytime_class_id` 부여.
- 학기 범위 안에서 `dayOfWeek`에 해당하는 모든 날짜 산출 → row 생성.
- 단위 테스트 대상 (Vitest).

## UX 플로우

```
홈 화면
└─ "에브리타임 시간표 가져오기" 탭
   └─ 시트 열림 (step: upload)
      ├─ 학기: ○ 1학기  ○ 2학기  ○ 직접 선택
      ├─ [이미지 업로드]
      ↓ (이미지 선택)
      step: analyzing — "시간표 읽는 중…"
      ↓ (Gemini 응답)
      step: preview
      ├─ ☑ 자료구조       월 09:00–10:30  IT405
      ├─ ☑ 운영체제       화 13:00–14:30  공학관 201
      ├─ ☐ 한국사 ⚠       수 15:00–16:30  [장소 미설정]
      ├─ … (인라인 편집 가능)
      └─ [12개 추가]
      ↓ (탭)
      step: done — "12개 수업이 학기 동안 추가됐어요" 토스트
      └─ 시트 닫힘, 캘린더 갱신
```

## 디자인 시스템 준수

- 색상: violet-600 (확인 버튼), gray-* (외곽), red-500 (오류), amber-500 (⚠ 누락)
- 라운드: 시트 상단 16px(2xl), 카드 12px(xl), 버튼 8px(lg)
- 폰트: Pretendard. 시간 텍스트는 본문 사이즈(text-sm) 그대로, Instrument Serif 미사용
- Tailwind 전용. 인라인 스타일 금지.
- 터치 타겟 min-h-11
- 다크모드: `dark:` 프리픽스로 모든 색상 대응
- 절대 사용 금지 항목 회피 (보라 그라데이션, 글래스모피즘, 20px+ radius 등)

## 보안 / 프라이버시

- 시간표 사진은 분석 직후 메모리에서 폐기. DB나 Supabase Storage에 저장하지 않음.
- `GEMINI_API_KEY`는 서버 환경변수만. 클라이언트 번들에 노출 금지.
- Gemini로 전송된 이미지의 Google 측 보존 정책은 Google AI Studio 약관에 따름. 학생에게 노출되는 데이터(과목명, 강의실)는 일반적으로 민감하지 않음.
- RLS는 기존 `schedules_all_self`(`auth.uid() = user_id`)가 그대로 커버.

## 테스트 전략

- **단위 (Vitest)**: `expand.ts` — 학기 범위 내 주차 산출, 시작=종료일, 시작>종료일, 학기 시작 전 요일 등 엣지.
- **통합 (수동)**: 실제 에브리타임 스크린샷 3~5장으로 미리보기 정확도 확인.
- **시연 시나리오**: 고려대 1학기 디폴트로 5~6과목 인식 → 미리보기 → 1과목 체크 해제 → 추가 → 캘린더에서 매주 반복 확인.

## 구현 순서 (분해)

이 spec은 다음 작업 단위로 분해된다 (writing-plans에서 상세화):

1. 마이그레이션 007 작성 + 타입 재생성
2. Gemini 클라이언트 + 프롬프트
3. `expand.ts` 순수 함수 + 단위 테스트
4. `/api/everytime/parse` 라우트
5. `/api/everytime/import` 라우트 (POST + DELETE)
6. `EverytimeImportSheet` 컴포넌트 (4-step)
7. `EverytimeImportButton` + 홈 진입점 통합
8. 시연 시나리오 수동 QA + `pnpm typecheck && pnpm lint`
