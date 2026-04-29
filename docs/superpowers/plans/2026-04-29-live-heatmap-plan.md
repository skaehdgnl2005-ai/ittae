# Live Heatmap 구현 플랜

설계: `docs/superpowers/specs/2026-04-29-live-heatmap-design.md`

## Tasks

### Task 1 — Realtime publication 마이그레이션
- 파일: `supabase/migrations/005_realtime_publication.sql` (신규)
- 내용:
  ```sql
  do $$
  begin
    alter publication supabase_realtime add table time_slots;
  exception when duplicate_object then null;
  end $$;
  ```
- (votes 테이블도 같은 방식으로 보강)

### Task 2 — TimeSlotCell 리팩터
- 항상 히트맵 색을 배경으로
- 내가 선택한 셀이면 `ring-[3px] ring-inset ring-violet-700` 오버레이
- pending start: 추가로 `ring-violet-500 ring-2`
- preview (드래그): 위에 violet-300/40 반투명 레이어
- `disabled` 분기는 날짜가 X일 때만 (기존 disabled 시 분기 유지)
- props: `showHeatmap` 제거, `selected/heatCount/totalMembers/isPendingStart/isPreview/disabled` 유지

### Task 3 — getHeatmapClass 비율 기반으로 변경
- TimeSlotCell 내부 함수 갱신

### Task 4 — TimeColumn / TimeGrid props 정리
- `showHeatmap` 제거; heatmap은 항상 계산해서 내려줌

### Task 5 — GroupDetailClient
- `showHeatmap` 변수 제거
- `<TimeGrid ... />` 호출에서 prop 제거

### Task 6 — 검증
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- (가능하면) `pnpm dev`로 그룹 상세 페이지 시각 확인

### Task 7 — 회귀 안전망
- 기존 vote.ts 단위 테스트는 그대로 통과해야 함 (`getTimeSlotHeatmap`, `getRankedTimeSlots`)
- TimeSlotCell의 색상 클래스 함수에 대한 단위 테스트는 추가하지 않음 (CSS 매핑 테스트는 비용 대비 효용이 낮음)
