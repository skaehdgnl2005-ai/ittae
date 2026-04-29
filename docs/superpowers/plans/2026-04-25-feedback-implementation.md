# 피드백 반영 구현 계획

## Context

심사위원 시연 후 받은 UX 피드백 6건을 반영한다. 핵심은 모바일 터치 UX 개선(드래그 선택), 검색 기능 추가, 현재 위치 지원이다. 가운데 지점 도출(F5)은 인프라 복잡도로 인해 이번 범위에서 제외.

**진행 상황 (2026-04-25):**
- ✅ Task 1, 2, 3, 4, 5 — 전체 완료

---

## Task 1: 달력 드래그 다중선택 (F1+F2) — 미완료

> 피드백: "날짜 여러개 택할 때 슬라이드하면 다 선택되게", "복수선택 2개만 됨"

**현재**: CandidateDatePicker는 클릭으로만 날짜 토글. 코드상 제한은 없지만 한 번에 하나씩만 선택 가능해서 불편.

**구현**:
- `src/hooks/useDragSelect.ts` 생성 (공용 드래그 훅)
  - PointerEvent API 사용 (mouse/touch 통합)
  - `onPointerDown` → 드래그 시작, `setPointerCapture`
  - `onPointerMove` → `document.elementFromPoint`로 현재 셀 탐지 (`data-date` 속성)
  - `onPointerUp` → 선택 확정
  - 스크롤 충돌 방지: 수평 이동 5px 이상 먼저 → 드래그, 수직 먼저 → 스크롤로 판별
  - 짧은 탭(이동 없이 up)은 기존 클릭 토글 유지

- `src/components/create/CandidateDatePicker.tsx` 수정
  - 각 날짜 버튼에 `data-date="YYYY-MM-DD"` 속성 추가
  - 그리드 컨테이너에 포인터 이벤트 핸들러 연결
  - 드래그 중: 스윕된 셀들에 `bg-violet-100` 프리뷰
  - 드래그 종료: 스윕된 날짜들 일괄 토글(선택되지 않은 것만 추가)

**파일**:
- NEW: [src/hooks/useDragSelect.ts](../../../src/hooks/useDragSelect.ts) (~70줄)
- MODIFY: [src/components/create/CandidateDatePicker.tsx](../../../src/components/create/CandidateDatePicker.tsx)

---

## Task 2: 친구 검색 기능 (F3) — 미완료

> 피드백: "친구 검색 기능"

**현재**: MemberSelector에 검색 없음. FriendList에는 이미 닉네임 검색 구현됨.

**구현**:
- `src/components/create/MemberSelector.tsx` 수정
  - `useState("")`로 검색 쿼리 상태 추가
  - FriendList와 동일한 검색 input UI 추가 (Search 아이콘 + 둥근 입력 필드)
  - `friends.filter(u => u.nickname.toLowerCase().includes(query.toLowerCase()))`
  - 선택된 친구 칩은 검색과 무관하게 항상 표시
  - 아바타 그리드만 필터링

**참고 패턴**: [src/components/friends/FriendList.tsx:28-60](../../../src/components/friends/FriendList.tsx#L28-L60) (기존 검색 구현)

**파일**:
- MODIFY: [src/components/create/MemberSelector.tsx](../../../src/components/create/MemberSelector.tsx) (+15줄)

---

## Task 3: 시간 드래그 선택 (F4) — ✅ 완료

> 피드백: "시간 선택할 때 0.2초 클릭 후 긁으면 긁혀지게"

**구현 완료 내역**:

- MODIFY: [src/hooks/useDragSelect.ts](../../../src/hooks/useDragSelect.ts) — `holdDelay` 옵션 추가
  - `onPointerDown` → `holdDelay` ms setTimeout 시작
  - 홀드 중 `scrollThreshold`(5px) 초과 이동 → 스크롤로 판단, 드래그 취소
  - 타이머 만료 → 드래그 모드 진입, `setPointerCapture`로 스크롤 차단
  - 드래그 중 셀 탐지: `data-slot="YYYY-MM-DDTHH:MM"` 단일 속성 사용

- MODIFY: [src/hooks/useTimeSlotSelection.ts](../../../src/hooks/useTimeSlotSelection.ts) — `commitSweptSlots(slotIds)` 추가
  - 스윕된 slot id 배열을 날짜별 그룹핑 → 정렬된 시간으로 연속 30분 슬롯을 range로 병합
  - 기존 ranges와 union 후 `rangesByDate` 갱신 → 기존 useEffect가 자동 서버 동기화

- MODIFY: [src/components/vote/TimeSlotCell.tsx](../../../src/components/vote/TimeSlotCell.tsx)
  - `date`, `isPreview` prop 추가
  - `data-slot="${date}T${time}"` 속성 부여 (히트맵 모드에선 미부여)
  - 드래그 프리뷰: `bg-violet-200 dark:bg-violet-500/40`

- MODIFY: [src/components/vote/TimeColumn.tsx](../../../src/components/vote/TimeColumn.tsx)
  - `previewSlots: Set<string>` prop 추가, 셀별 `isPreview` 판정

- MODIFY: [src/components/vote/TimeGrid.tsx](../../../src/components/vote/TimeGrid.tsx)
  - `useDragSelect({ attribute: "data-slot", holdDelay: 350 })` 연결
  - 안내 텍스트: "양끝 클릭으로 구간 선택" → "꾹 눌러서 드래그 또는 양끝 클릭"
  - 드래그 중 `touch-none`, idle 시 `touch-pan-y`로 수직 스크롤 보존
  - 히트맵 모드(`showHeatmap=true`)에선 핸들러 미부착

- MODIFY: [src/app/group/[id]/GroupDetailClient.tsx](../../../src/app/group/%5Bid%5D/GroupDetailClient.tsx)
  - `commitSweptSlots`을 TimeGrid의 `onDragCommit`으로 전달

- 기존 클릭 선택은 접근성 폴백으로 유지

**홀드 지연(holdDelay) 결정**:
- 피드백은 "0.2초"였으나 실제로는 모바일에서 스크롤 직전 finger settling 시간(100~150ms)과 너무 가까워 오발 위험이 큼
- 플랫폼 표준(iOS/Android long-press 500ms, Material 300~500ms) 참고하여 **350ms**로 조정
- "긁히는 느낌"이라는 요구사항 의도는 유지하면서 스크롤과의 충돌을 줄이는 균형점

---

## Task 4: 친구 없이 모임 생성 + 링크 공유 (F6) — 미완료

> 피드백: "친구 선택 안 해도 모임 만들어지게! 링크 공유로 유입 유도"

**현재**: API는 이미 memberIds 선택사항. 폼 canSubmit도 친구 미체크. 하지만 UX에서 링크 공유를 안내하지 않음.

**구현**:
- `src/components/create/MemberSelector.tsx` 수정
  - 빈 상태 메시지 개선: "친구를 선택하지 않아도 모임을 만들 수 있어요. 생성 후 초대 링크를 공유하세요!"
  - 친구가 있지만 아무도 선택하지 않았을 때 힌트 추가: "선택하지 않으면 링크로 초대할 수 있어요"

- `src/app/group/[id]/GroupDetailClient.tsx` 수정
  - 헤더 영역에 "링크 복사" 버튼 추가
  - `navigator.clipboard.writeText(window.location.href)` → 토스트 피드백 "링크가 복사되었어요!"
  - Link2 아이콘 (lucide-react) 사용

**파일**:
- MODIFY: [src/components/create/MemberSelector.tsx](../../../src/components/create/MemberSelector.tsx)
- MODIFY: [src/app/group/[id]/GroupDetailClient.tsx](../../../src/app/group/[id]/GroupDetailClient.tsx)

---

## Task 5: 지도 현재 위치 버튼 (F7) — ✅ 완료

> 피드백: "현재 위치 찾아주는 버튼 (지금은 서울시청으로 위치나옴)"

**구현 완료 내역**:
- NEW: [src/hooks/useGeolocation.ts](../../../src/hooks/useGeolocation.ts) — onSuccess 콜백 패턴
- MODIFY: [src/app/(main)/map/page.tsx](../../../src/app/(main)/map/page.tsx) — center 상태, geolocation 연동, 플로팅 버튼 (우하단), 에러 토스트
- MODIFY: [src/components/map/MapView.tsx](../../../src/components/map/MapView.tsx) — center 변경 시 `map.panTo()` 호출

---

## 권장 진행 순서

| 순서 | Task | 난이도 | 예상 시간 |
|------|------|--------|----------|
| 1 | Task 2: 친구 검색 | 낮음 | 20분 |
| 2 | Task 4: 링크 공유 UX | 낮음 | 30분 |
| 3 | Task 1: 달력 드래그 선택 | 중상 | 1시간 |
| 4 | Task 3: 시간 드래그 선택 | 중상 | 1시간 |

Quick win (Task 2, 4) 먼저 → 드래그 UX (Task 1, 3) 순서.
Task 1과 Task 3은 `useDragSelect` 훅을 공유하므로 Task 1 먼저 진행 후 Task 3에서 holdDelay 옵션 확장.

---

## 검증 방법

1. `pnpm dev`로 개발 서버 실행
2. 각 기능 수동 테스트:
   - 모임 만들기 → 친구 검색 입력 → 필터링 동작 확인 (Task 2)
   - 모임 만들기 → 친구 미선택 → 모임 생성 성공 + 링크 복사 버튼 확인 (Task 4)
   - 모임 만들기 → 달력에서 드래그 → 여러 날짜 한 번에 선택 확인 (Task 1)
   - 투표 화면 → 시간 그리드에서 0.2초 누른 후 드래그 → 구간 선택 확인 (Task 3)
3. `pnpm typecheck && pnpm lint` 통과 확인
4. 모바일 시뮬레이터(Chrome DevTools)에서 터치 이벤트 테스트

---

## Task 5 검증 체크 (이미 완료)

- 지도 탭 → 우하단 LocateFixed 아이콘 버튼 보임
- 버튼 클릭 → 위치 권한 요청 다이얼로그
- 권한 허용 → 현재 위치로 지도 이동 + 카테고리 선택 시 재검색
- 권한 거부 → 빨간 토스트로 한국어 에러 메시지
