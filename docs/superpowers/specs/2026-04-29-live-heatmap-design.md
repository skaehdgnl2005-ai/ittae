# 시간표 투표 — Live Heatmap (When2meet 스타일) 설계

## 배경

기존 시간표 투표(`2026-04-14-time-slot-voting-design.md`)는 "모든 멤버가 모든 날짜에 투표를 완료해야만 히트맵 색이 켜지는" 결과 보기 모드였다.
실제 사용자 경험에서는:

- **링크를 공유받은 멤버**가 들어와도 기존 멤버들이 등록한 시간대가 화면에 나타나지 않는다 (allVoted = false → 히트맵 숨김).
- 첫 번째로 투표하는 사람은 아무 정보도 없이 빈 그리드만 본다.
- 즉, "When2meet"의 핵심 가치인 **상대방 선택을 보면서 내 가능 시간을 맞추는** 인터랙션이 빠져 있다.

본 설계는 히트맵을 **항상 켜진 배경**으로 끌어올리고, 내 선택을 그 위의 **레이어로 분리**해서 두 가지를 동시에 표시한다.

## 변경 범위

### 변경 1: 히트맵 게이팅 제거

- `showHeatmap` 플래그를 제거한다. 히트맵은 그리드가 표시되는 한 항상 계산·표시된다.
- `BestTimeBanner`는 이미 `slots.length === 0`일 때 자동 숨김 → 그대로 둔다.
- `isAllVoted`는 호스트의 "확정" 버튼 활성화에만 계속 사용한다 (확정은 전원 투표 후).

### 변경 2: 셀의 시각 레이어 분리

각 30분 셀은 두 정보를 동시에 표현한다:

| 레이어 | 정보 | 표현 |
|--------|------|------|
| 배경 (background) | 이 슬롯을 선택한 전체 인원 수 (히트맵) | 색상 그라데이션: 흰색 → violet-700 |
| 전경 (foreground) | 내가 선택한 슬롯인지 | `ring-[3px] ring-inset ring-violet-700` 오버레이 |

배경 색은 어떤 선택 상태에서도 보이고, 내 선택 ring은 색 위에 얹혀서 하이콘트라스트로 식별된다.

### 변경 3: 셀은 항상 클릭 가능

`disabled={showHeatmap}` 패턴 제거. 날짜를 X로 표시한 칸만 비활성(opacity 0.35) 유지.

### 변경 4: 히트맵 색 스케일

기존(절대값 기준)은 멤버 수에 따라 의미가 달랐다. 비율(ratio = count/total) 기반으로 통일:

| 비율 | 색 (라이트 / 다크) |
|------|--------------------|
| 0 | bg-gray-50 / bg-gray-800/50 |
| 0 < r < 0.25 | bg-violet-100 / bg-violet-900/40 |
| 0.25 ≤ r < 0.5 | bg-violet-200 / bg-violet-700/40 |
| 0.5 ≤ r < 0.75 | bg-violet-400 / bg-violet-400 |
| 0.75 ≤ r < 1 | bg-violet-500 / bg-violet-500 |
| r = 1 (전원) | bg-violet-700 / bg-violet-600 |

### 변경 5: 내 선택의 즉각 반영

내가 셀을 클릭/드래그하면 `useTimeSlotSelection`의 `rangesByDate`가 즉시 업데이트되어 ring이 바로 보인다 (낙관적). 서버 PUT → realtime INSERT로 `allTimeSlots`에 합류해 히트맵 카운트가 +1 되는 데 일반적으로 100~300ms 소요. ring은 즉시이므로 사용자 입장에서 lag 체감은 없다.

### 변경 6: time_slots Realtime publication 추가

`time_slots` 테이블이 `supabase_realtime` publication에 포함되어야 다른 탭/유저의 변경이 실시간 반영된다. 002 마이그레이션에 누락되어 있으므로 별도 마이그레이션으로 추가한다 (이미 추가되어 있으면 무해하게 실패하도록 `do $$` 블록 사용).

## 영향받는 파일

| 파일 | 변경 |
|------|------|
| `supabase/migrations/005_realtime_publication.sql` (신규) | `alter publication supabase_realtime add table time_slots` (idempotent) |
| `src/components/vote/TimeSlotCell.tsx` | 항상 히트맵 배경 + ring 오버레이; disabled 제거 |
| `src/components/vote/TimeColumn.tsx` | `showHeatmap` 파라미터 제거 |
| `src/components/vote/TimeGrid.tsx` | `showHeatmap` 파라미터 제거; 드래그는 X 날짜만 비활성 |
| `src/app/group/[id]/GroupDetailClient.tsx` | `showHeatmap` 변수/전달 제거 |
| `src/lib/__tests__/vote.test.ts` | 변경 없음 (vote.ts API는 유지) |

## 비변경 사항

- 양끝 클릭 / 드래그 인터랙션 로직 (useTimeSlotSelection, useDragSelect)
- API 라우트 (`PUT /api/vote-sessions/[id]/time-slots`)
- 호스트 확정 플로우
- 데이터 모델 (time_slots 테이블 스키마, RLS 정책)

## 위험 / 트레이드오프

- **시각적 노이즈**: 모든 멤버가 한두 슬롯만 채운 초기에는 ring과 배경이 동시에 보여서 살짝 빽빽해 보일 수 있다. → 색 스케일을 흰색에 가까운 violet-100부터 시작하므로 1명일 때는 거의 흰색에 가깝다.
- **Realtime publication**: 마이그레이션이 적용되지 않은 환경에서는 같은 페이지를 새로고침하지 않으면 동기화가 지연된다. 새로고침으로 우회 가능하지만, 마이그레이션 적용 권장.
- **공유 링크로 비멤버가 진입**: 현재 `/group/[id]`는 비멤버에게 404를 반환한다. 그룹 자동 가입 플로우는 본 설계 범위 밖이며, 별도 작업이 필요하다.
