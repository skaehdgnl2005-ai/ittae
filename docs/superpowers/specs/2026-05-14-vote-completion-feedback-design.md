# 투표 완료 피드백 강화 — 설계 문서

작성일: 2026-05-14
대상 화면: 그룹 상세 투표(`/group/[id]`) · 게스트 투표(`/g/[code]`)
대상 컴포넌트: [src/components/vote/VoteActionBar.tsx](../../../src/components/vote/VoteActionBar.tsx)
관련 호출부: [src/app/group/[id]/GroupDetailClient.tsx](../../../src/app/group/[id]/GroupDetailClient.tsx),
[src/app/g/[code]/GuestVoteClient.tsx](../../../src/app/g/[code]/GuestVoteClient.tsx)

## 1. 배경

피드백: "투표가 완료되었음을 나타내는 로직이 부족하다."

현재 투표 화면에서 사용자가 본인 투표를 저장한 뒤 받는 시그널은 다음 셋이 전부다.

1. 저장 직후 2.9초간 `저장됐어요!` 칩 표시 (`justSaved` 플래시)
2. 좌측 버튼 라벨 `투표 등록하기` → `다시 등록하기` 전환
3. 시간표에 본인이 찍은 셀 표시 (다른 참여자 셀과 색 차이 미세)

페이지 재방문/스크롤 후에는 **"내 투표가 저장된 상태인지"가 영구적으로 보장되는 영역이 없다.** 또한
"다시 등록하기"라는 라벨은 의미가 "처음부터 다시"에 가까워 완료보다 미완 상태로 읽힌다. 게스트는 호스트 전용
우측 버튼이 없어 다음 액션을 안내받지 못한다.

## 2. 목표

- 본인 투표 저장 상태를 **영구적으로** 시각화한다 (스크롤·재방문 후에도 보임).
- 저장 후 좌측 버튼 라벨이 **수정 액션**임을 명확히 한다.
- 호스트 우측 버튼이 **참여 진행률**을 표시해 "왜 확정 버튼이 비활성인지" 이유를 드러낸다.
- 게스트도 동일한 좌측 상태 라인을 본다 (호스트 분기 없음).

비목표 (YAGNI):

- 시간표 위 워터마크/오버레이 추가 (Approach C에서 검토했으나 제외)
- 상단 별도 status 배너 추가 (Approach A에서 검토했으나 제외)
- "미저장 변경 사항 있음" 경고 표시 — 시간 슬롯은 이미 PUT effect로 자동 저장되므로 의미 없음

## 3. 채택 접근

**Approach B: VoteActionBar 자체에 status line + 라벨 동적화.**

화면 상단(BestTimeBanner)을 건드리지 않고 하단 액션바 안에서 정보를 응집한다. 새 컴포넌트 없이 기존 컴포넌트
1개를 확장한다.

## 4. 컴포넌트 변경 — VoteActionBar

### 4.1 Props 시그니처

기존 props 유지 + 다음 3개 추가:

```ts
type VoteActionBarProps = {
  // 기존
  hasMyVotes: boolean;
  hasSavedBefore: boolean;
  isHost: boolean;
  allVoted: boolean;
  onSaveMyVote: () => Promise<void>;
  onConfirm: () => void;
  withBottomNav?: boolean;
  inline?: boolean;
  // 신규
  mySlotCount: number;        // 내가 선택한 시간 구간 개수
  votedCount: number;         // 투표 완료한 참여자 수 (멤버+게스트)
  totalParticipants: number;  // 전체 참여자 수
};
```

### 4.2 렌더 구조

```
┌─ VoteActionBar ──────────────────────────┐
│ [status line — savedShown일 때만 렌더]    │
│  ✓ 내 투표 저장됨 · 시간 N구간 선택        │
│ [button row]                              │
│  ┌────────────┐  ┌────────────────────┐  │
│  │투표 수정하기│  │N명 중 M명 투표 중   │  │
│  └────────────┘  └────────────────────┘  │
└──────────────────────────────────────────┘
```

`savedShown = (hasSavedBefore || savedOnceLocal) && !justSaved` — `justSaved` 동안은 좌측 버튼 자체가
"저장됐어요!" 칩으로 강조되므로 status line 중복 표시를 피한다.

### 4.3 상태별 라벨 매트릭스

| 상태 | 좌측 라벨 | 우측 라벨 (host) |
|---|---|---|
| `!hasMyVotes` (입력 없음) | `투표 등록하기` (disabled) | `투표 대기 중` (disabled) |
| `hasMyVotes && !showAsResubmit` | `투표 등록하기` (primary) | `투표 대기 중` (disabled) |
| `justSaved` (2.9s flash) | `저장됐어요!` + Check 칩 | `투표 대기 중` (disabled) |
| `showAsResubmit && !justSaved` | `투표 수정하기` (outlined) | `N명 중 M명 투표 중` (disabled) |
| `allVoted` (전원 완료, host) | `투표 수정하기` (outlined) | `일정 확정하러 가기` (primary) |

기존 변수 `showAsResubmit = hasSavedBefore || savedOnceLocal`를 그대로 활용한다.

좌측 라벨 결정 로직:

```ts
const saveLabel = saving
  ? "저장 중..."
  : justSaved
    ? "저장됐어요!"
    : showAsResubmit
      ? "투표 수정하기"   // 기존 "다시 등록하기"에서 변경
      : "투표 등록하기";
```

우측 라벨 결정 로직 (host에서만 렌더):

```ts
const rightLabel = allVoted
  ? "일정 확정하러 가기"
  : `${totalParticipants}명 중 ${votedCount}명 투표 중`;
```

### 4.4 시각 디자인

**Status line:**

```tsx
<div
  role="status"
  aria-live="polite"
  className="mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
             bg-violet-50 border border-violet-200
             dark:bg-violet-900/20 dark:border-violet-800/60"
>
  <Check size={14} strokeWidth={2.5}
         className="text-violet-600 dark:text-violet-400 shrink-0" />
  <span className="text-[12px] font-medium text-violet-700 dark:text-violet-300">
    내 투표 저장됨 · 시간 {mySlotCount}구간 선택
  </span>
</div>
```

- 색상: 디자인 시스템 violet 팔레트 (indigo·네온·그라데이션 금지)
- 둥글기: `rounded-lg` (8px). 카드(12px) 미만의 보조 요소 규격
- `role="status" aria-live="polite"`: 저장 직후 스크린리더가 상태 변화 알림

**저장 후 좌측 버튼 (outlined):**

```
bg-white border border-violet-300 text-violet-700
hover:bg-violet-50
dark:bg-gray-900 dark:border-violet-700 dark:text-violet-300
```

저장 전 primary 버튼(`bg-violet-600 text-white`)과 시각적으로 분리해 "이미 완료" 톤을 전달한다.
`justSaved` 칩 스타일은 기존 그대로 유지.

`hasMyVotes=true && !showAsResubmit` 상태(저장 직전)에서는 기존 primary 스타일을 유지.

## 5. 호출부 변경

### 5.1 GroupDetailClient.tsx

`hasMyVotes` 계산 부근에 추가:

```ts
const mySlotCount = useMemo(
  () => Object.values(voteHook.rangesByDate)
    .reduce((sum, ranges) => sum + ranges.length, 0),
  [voteHook.rangesByDate]
);

const votedCount = countVotedParticipants(votes);
```

`VoteActionBar` 호출에 3개 props 추가:

```tsx
<VoteActionBar
  hasMyVotes={hasMyVotes}
  hasSavedBefore={hasSavedBefore}
  isHost={isHost}
  allVoted={allVoted}
  mySlotCount={mySlotCount}
  votedCount={votedCount}
  totalParticipants={totalParticipants}
  onSaveMyVote={handleMyVoteSave}
  onConfirm={handleEnterConfirm}
  inline
/>
```

### 5.2 GuestVoteClient.tsx

동일 계산을 `GuestVoteInner`에 추가한다. `votes`는 `useGuestRealtime`이 반환하는 배열을 사용한다.

```ts
const mySlotCount = useMemo(
  () => Object.values(rangesByDate)
    .reduce((sum, ranges) => sum + ranges.length, 0),
  [rangesByDate]
);

const votedCount = countVotedParticipants(votes);
```

`isHost={false}`이므로 우측 버튼은 렌더되지 않지만, 좌측 status line은 동일하게 표시된다.

## 6. lib/vote.ts 헬퍼

중복 제거를 위해 공용 함수 1개 추가:

```ts
export function countVotedParticipants(votes: Vote[]): number {
  const ids = new Set<string>();
  votes.forEach((v) => {
    if (v.userId) ids.add(`u:${v.userId}`);
    if (v.guestId) ids.add(`g:${v.guestId}`);
  });
  return ids.size;
}
```

- 같은 사용자가 여러 날짜에 투표해도 한 번만 카운트
- 회원/게스트 ID 충돌 방지를 위해 `u:`/`g:` 프리픽스 사용

## 7. 테스트

[src/lib/__tests__/vote.test.ts](../../../src/lib/__tests__/vote.test.ts)에 `countVotedParticipants` 유닛 테스트 추가:

1. 빈 배열 → 0
2. 같은 userId가 3개 날짜 → 1
3. userId 2명 + guestId 3명 → 5
4. userId="abc"와 guestId="abc"가 섞여 있을 때 → 2 (프리픽스로 구분)

VoteActionBar 자체의 렌더 테스트는 추가하지 않는다 (기존에도 없음, 시각 회귀는 디자인 시스템 룰로 커버).

## 8. 디자인 시스템 준수 확인

- 색상: violet-50/200/300/600/700, gray-100~900만 사용. indigo·neon·gradient 없음.
- 둥글기: rounded-lg(8px), rounded-xl(12px)만 사용. 20px 이상 없음.
- 폰트: 본문 Pretendard(기본 상속), 숫자 강조 별도 처리 없음 (참여 진행률은 본문 사이즈).
- 인라인 스타일 없음. `cn()` 유틸리티로 조건부 클래스.
- 다크모드 모든 색상 대응.
- 접근성: `role="status"` + `aria-live="polite"`, 버튼 `aria-label`, 터치 타겟 52px(기존 유지).

## 9. 변경 파일 요약

| 파일 | 변경 종류 | 추정 라인 변화 |
|---|---|---|
| `src/components/vote/VoteActionBar.tsx` | 확장 | 106 → ~140 |
| `src/app/group/[id]/GroupDetailClient.tsx` | props 추가 + 계산 | +10 (340 → 350) |
| `src/app/g/[code]/GuestVoteClient.tsx` | props 추가 + 계산 | +10 (267 → 277) |
| `src/lib/vote.ts` | 헬퍼 추가 | +8 |
| `src/lib/__tests__/vote.test.ts` | 유닛 테스트 추가 | +20 |

`GroupDetailClient`/`GuestVoteClient`는 200줄 룰 예외 등록된 파일이므로 추가 무방
(참조: `project_200line_exemptions` 메모리).

## 10. 완료 기준

- `pnpm typecheck` 통과
- `pnpm lint` 통과
- `pnpm test` 통과 (신규 `countVotedParticipants` 테스트 4개 포함)
- 호스트로 그룹 상세 진입 → 시간 선택 → 저장 → status line 영구 표시, 좌측 "투표 수정하기", 우측 "N명 중 M명 투표 중" 확인
- 게스트 링크 진입 → 닉네임 → 시간 선택 → 저장 → status line 동일 표시 확인
- 다크모드 토글 시 색상 정상 표시
