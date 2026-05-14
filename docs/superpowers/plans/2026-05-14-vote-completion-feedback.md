# 투표 완료 피드백 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VoteActionBar에 영구 status line + 동적 라벨을 추가해 "내 투표가 저장된 상태"를 명확히 시각화한다.

**Architecture:** 새 컴포넌트 없이 기존 VoteActionBar 1개를 확장한다. `countVotedParticipants` 공용 헬퍼를 `lib/vote.ts`에 1개 추가하고, 호출부 2곳(GroupDetailClient, GuestVoteClient)이 동일하게 props를 넘긴다.

**Tech Stack:** React 18 · Next.js 14 App Router · TypeScript · Tailwind CSS · Vitest · lucide-react

**Reference Spec:** [docs/superpowers/specs/2026-05-14-vote-completion-feedback-design.md](../specs/2026-05-14-vote-completion-feedback-design.md)

---

## File Structure

- **Modify** `src/lib/vote.ts` — `countVotedParticipants` 헬퍼 1개 export 추가
- **Modify** `src/lib/__tests__/vote.test.ts` — 헬퍼 유닛 테스트 추가
- **Modify** `src/components/vote/VoteActionBar.tsx` — Props 확장, status line JSX 추가, 좌측 라벨 변경, 우측 라벨 동적화, 저장 후 좌측 버튼 outlined 스타일
- **Modify** `src/app/group/[id]/GroupDetailClient.tsx` — `mySlotCount`/`votedCount` 계산 추가, VoteActionBar 호출에 3 props 추가
- **Modify** `src/app/g/[code]/GuestVoteClient.tsx` — 동일 계산/호출 추가

---

## Task 1: `countVotedParticipants` 헬퍼 (TDD)

**Files:**
- Modify: `src/lib/__tests__/vote.test.ts`
- Modify: `src/lib/vote.ts`

- [ ] **Step 1.1: 실패하는 테스트 작성**

`src/lib/__tests__/vote.test.ts` 파일 맨 위 import 라인에 `countVotedParticipants`를 추가하고, 파일 끝부분(마지막 `describe` 블록 뒤)에 다음 describe 블록을 추가한다.

```ts
import {
  getAvailableParticipantsForSlot,
  getBestTimeSlot,
  getRankedTimeSlots,
  getTimeSlotHeatmap,
  TIME_SLOTS,
  getVoteSummary,
  countVotedParticipants,
} from "@/lib/vote";
```

```ts
describe("countVotedParticipants", () => {
  it("returns 0 for empty array", () => {
    expect(countVotedParticipants([])).toBe(0);
  });

  it("counts same user voting on 3 dates as 1", () => {
    const votes: Vote[] = [
      { id: "v1", sessionId: "vs1", userId: "u1", date: "2026-04-25", choice: "available", comment: null },
      { id: "v2", sessionId: "vs1", userId: "u1", date: "2026-04-26", choice: "available", comment: null },
      { id: "v3", sessionId: "vs1", userId: "u1", date: "2026-04-27", choice: "available", comment: null },
    ];
    expect(countVotedParticipants(votes)).toBe(1);
  });

  it("counts 2 users + 3 guests as 5", () => {
    const votes: Vote[] = [
      { id: "v1", sessionId: "vs1", userId: "u1", date: "2026-04-25", choice: "available", comment: null },
      { id: "v2", sessionId: "vs1", userId: "u2", date: "2026-04-25", choice: "available", comment: null },
      { id: "v3", sessionId: "vs1", userId: null, guestId: "g1", date: "2026-04-25", choice: "available", comment: null },
      { id: "v4", sessionId: "vs1", userId: null, guestId: "g2", date: "2026-04-25", choice: "available", comment: null },
      { id: "v5", sessionId: "vs1", userId: null, guestId: "g3", date: "2026-04-25", choice: "available", comment: null },
    ];
    expect(countVotedParticipants(votes)).toBe(5);
  });

  it("treats userId='abc' and guestId='abc' as distinct (prefix isolation)", () => {
    const votes: Vote[] = [
      { id: "v1", sessionId: "vs1", userId: "abc", date: "2026-04-25", choice: "available", comment: null },
      { id: "v2", sessionId: "vs1", userId: null, guestId: "abc", date: "2026-04-25", choice: "available", comment: null },
    ];
    expect(countVotedParticipants(votes)).toBe(2);
  });
});
```

타입 참고: `Vote.userId: string | null` (nullable, optional 아님), `Vote.guestId?: string | null` (optional). 게스트 투표의 경우 `userId: null`을 명시한다.

- [ ] **Step 1.2: 테스트 실행해서 실패 확인**

Run: `pnpm test -- --run vote.test`
Expected: `countVotedParticipants` import에서 빌드 실패 (함수 미정의).

- [ ] **Step 1.3: 헬퍼 구현**

`src/lib/vote.ts`의 마지막 export 뒤에 다음 함수를 추가한다.

```ts
/**
 * 투표한 고유 참여자 수를 반환한다.
 * 같은 사용자가 여러 날짜에 투표해도 1로 카운트한다.
 * userId="abc"와 guestId="abc"는 프리픽스로 분리해 별도 인원으로 본다.
 */
export function countVotedParticipants(votes: Vote[]): number {
  const ids = new Set<string>();
  votes.forEach((v) => {
    if (v.userId) ids.add(`u:${v.userId}`);
    if (v.guestId) ids.add(`g:${v.guestId}`);
  });
  return ids.size;
}
```

- [ ] **Step 1.4: 테스트 실행해서 통과 확인**

Run: `pnpm test -- --run vote.test`
Expected: 신규 4개 케이스 포함 모두 PASS.

- [ ] **Step 1.5: 커밋**

```bash
git add src/lib/vote.ts src/lib/__tests__/vote.test.ts
git commit -m "feat(vote): countVotedParticipants 헬퍼 추가 — 고유 참여자 카운트"
```

---

## Task 2: VoteActionBar 확장 — Props · Status line · 라벨 · 스타일

**Files:**
- Modify: `src/components/vote/VoteActionBar.tsx`

- [ ] **Step 2.1: Props 타입 확장**

`VoteActionBarProps` 타입에 3개 필드를 추가한다.

```ts
type VoteActionBarProps = {
  hasMyVotes: boolean;
  hasSavedBefore: boolean;
  isHost: boolean;
  allVoted: boolean;
  onSaveMyVote: () => Promise<void>;
  onConfirm: () => void;
  /** true면 하단 BottomNav 위(bottom-[83px])에 띄움. false면 화면 하단(bottom-0). 기본 true. inline=true면 무시. */
  withBottomNav?: boolean;
  /** flex column 페이지 안에서 자연 흐름으로 배치할 때 true. fixed 포지셔닝 제거. */
  inline?: boolean;
  /** 내가 선택한 시간 구간 개수 (status line 표시용) */
  mySlotCount: number;
  /** 투표 완료한 참여자 수 (호스트 우측 버튼 라벨용) */
  votedCount: number;
  /** 전체 참여자 수 (호스트 우측 버튼 라벨용) */
  totalParticipants: number;
};
```

함수 시그니처도 동일하게 확장한다.

```ts
export function VoteActionBar({
  hasMyVotes,
  hasSavedBefore,
  isHost,
  allVoted,
  onSaveMyVote,
  onConfirm,
  withBottomNav = true,
  inline = false,
  mySlotCount,
  votedCount,
  totalParticipants,
}: VoteActionBarProps) {
```

- [ ] **Step 2.2: 좌측 라벨 "다시 등록하기" → "투표 수정하기"**

`saveLabel` 변수 부분을 다음으로 변경한다.

```ts
const saveLabel = saving
  ? "저장 중..."
  : justSaved
    ? "저장됐어요!"
    : showAsResubmit
      ? "투표 수정하기"
      : "투표 등록하기";
```

- [ ] **Step 2.3: status line 표시 조건 변수 추가**

`saveLabel` 정의 뒤에 다음 한 줄을 추가한다.

```ts
const savedShown = showAsResubmit && !justSaved;
```

- [ ] **Step 2.4: status line JSX + 좌측 버튼 outlined 스타일 + 우측 버튼 동적 라벨**

return 문 안의 최상위 `<div>` 내부를 아래 구조로 교체한다. 기존 코드와의 차이:

1. button row를 감싸던 `<div className="flex gap-2">` 위에 status line `<div>` 추가
2. 좌측 버튼 className에 `savedShown` 분기 추가 (outlined 스타일)
3. 우측 버튼 라벨/aria-label에 `votedCount`/`totalParticipants` 반영

`Check` 아이콘은 이미 import 되어 있다(`import { Check } from "lucide-react";`).

```tsx
  return (
    <div
      className={cn(
        "px-5 py-3 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800",
        inline
          ? "w-full"
          : cn(
              "fixed left-1/2 -translate-x-1/2 w-full max-w-[430px]",
              withBottomNav ? "bottom-[83px]" : "bottom-0"
            )
      )}
    >
      {savedShown && (
        <div
          role="status"
          aria-live="polite"
          className="mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 dark:bg-violet-900/20 dark:border-violet-800/60"
        >
          <Check
            size={14}
            strokeWidth={2.5}
            className="text-violet-600 dark:text-violet-400 shrink-0"
          />
          <span className="text-[12px] font-medium text-violet-700 dark:text-violet-300">
            내 투표 저장됨 · 시간 {mySlotCount}구간 선택
          </span>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasMyVotes || saving}
          aria-label={saveLabel}
          className={cn(
            "flex-1 h-[52px] rounded-xl text-[15px] font-semibold transition-all duration-300 active:scale-[0.97] flex items-center justify-center gap-1.5",
            justSaved
              ? "bg-violet-100 text-violet-700 ring-2 ring-violet-300/70 shadow-sm scale-[1.02] dark:bg-violet-900/40 dark:text-violet-200 dark:ring-violet-500/40"
              : savedShown
                ? "bg-white border border-violet-300 text-violet-700 hover:bg-violet-50 dark:bg-gray-900 dark:border-violet-700 dark:text-violet-300"
                : hasMyVotes
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
          )}
        >
          {justSaved && <Check size={18} strokeWidth={2.4} />}
          {saveLabel}
        </button>

        {isHost && (
          <button
            onClick={onConfirm}
            disabled={!allVoted}
            aria-label={allVoted ? "일정 확정하러 가기" : `${totalParticipants}명 중 ${votedCount}명 투표 중`}
            className={cn(
              "flex-1 h-[52px] rounded-xl text-[15px] font-semibold transition-all active:scale-[0.97]",
              allVoted
                ? "bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
            )}
          >
            {allVoted
              ? "일정 확정하러 가기"
              : `${totalParticipants}명 중 ${votedCount}명 투표 중`}
          </button>
        )}
      </div>
    </div>
  );
```

- [ ] **Step 2.5: typecheck로 확인 (호출부 미수정 → 에러 예상)**

Run: `pnpm typecheck`
Expected: `GroupDetailClient.tsx`/`GuestVoteClient.tsx`에서 신규 props 누락 에러 발생. Task 3에서 해결한다. **이 시점에서는 커밋하지 않는다** — 빌드가 깨진 채로 커밋하지 않기 위해 Task 3와 함께 커밋.

---

## Task 3: 호출부 2곳 동시 수정 — props 계산 추가

**Files:**
- Modify: `src/app/group/[id]/GroupDetailClient.tsx`
- Modify: `src/app/g/[code]/GuestVoteClient.tsx`

- [ ] **Step 3.1: GroupDetailClient import + 계산 추가**

`GroupDetailClient.tsx` 상단 `getRankedTimeSlots, isAllVoted` import 라인에 `countVotedParticipants`를 추가한다.

```ts
import {
  getRankedTimeSlots,
  isAllVoted,
  countVotedParticipants,
  type BestTimeResult,
} from "@/lib/vote";
```

`hasSavedBefore` 정의 직후에 다음 두 줄을 추가한다 (`useMemo` import는 이미 있음).

```ts
const mySlotCount = useMemo(
  () =>
    Object.values(voteHook.rangesByDate).reduce(
      (sum, ranges) => sum + ranges.length,
      0
    ),
  [voteHook.rangesByDate]
);
const votedCount = useMemo(() => countVotedParticipants(votes), [votes]);
```

- [ ] **Step 3.2: GroupDetailClient의 VoteActionBar 호출에 신규 props 3개 추가**

기존 호출(파일 끝 부근 mode === "vote" 분기):

```tsx
<VoteActionBar
  hasMyVotes={hasMyVotes}
  hasSavedBefore={hasSavedBefore}
  isHost={isHost}
  allVoted={allVoted}
  onSaveMyVote={handleMyVoteSave}
  onConfirm={handleEnterConfirm}
  inline
/>
```

→ 다음으로 변경.

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

- [ ] **Step 3.3: GuestVoteClient import + 계산 추가**

`GuestVoteClient.tsx`의 `getRankedTimeSlots` import 라인을 다음으로 변경한다.

```ts
import { getRankedTimeSlots, countVotedParticipants } from "@/lib/vote";
```

`hasSavedBefore` 정의 직후에 동일한 두 계산을 추가한다.

```ts
const mySlotCount = useMemo(
  () =>
    Object.values(rangesByDate).reduce(
      (sum, ranges) => sum + ranges.length,
      0
    ),
  [rangesByDate]
);
const votedCount = useMemo(() => countVotedParticipants(votes), [votes]);
```

- [ ] **Step 3.4: GuestVoteClient의 VoteActionBar 호출에 신규 props 3개 추가**

기존 호출:

```tsx
<VoteActionBar
  hasMyVotes={hasMyVotes}
  hasSavedBefore={hasSavedBefore}
  isHost={false}
  allVoted={false}
  onSaveMyVote={handleMyVoteSave}
  onConfirm={() => {}}
  inline
/>
```

→ 다음으로 변경.

```tsx
<VoteActionBar
  hasMyVotes={hasMyVotes}
  hasSavedBefore={hasSavedBefore}
  isHost={false}
  allVoted={false}
  mySlotCount={mySlotCount}
  votedCount={votedCount}
  totalParticipants={totalParticipants}
  onSaveMyVote={handleMyVoteSave}
  onConfirm={() => {}}
  inline
/>
```

- [ ] **Step 3.5: 통합 검증 — typecheck · lint · test**

Run: `pnpm typecheck`
Expected: 에러 0개.

Run: `pnpm lint`
Expected: 에러 0개 (경고는 기존 수준 유지).

Run: `pnpm test -- --run`
Expected: 모든 테스트 PASS (`countVotedParticipants` 4개 + 기존 통과).

- [ ] **Step 3.6: 커밋**

```bash
git add src/components/vote/VoteActionBar.tsx \
        src/app/group/[id]/GroupDetailClient.tsx \
        src/app/g/[code]/GuestVoteClient.tsx
git commit -m "feat(vote): VoteActionBar status line + 동적 라벨 — 완료 상태 영구 표시"
```

---

## Task 4: 빌드 검증

**Files:** (none)

- [ ] **Step 4.1: 프로덕션 빌드 확인**

Run: `pnpm build`
Expected: 빌드 성공. 에러 0개. Next.js가 `/group/[id]`, `/g/[code]` 라우트를 컴파일할 때 신규 props 관련 에러 없음.

빌드 실패 시 에러 메시지를 확인하고 Task 3의 호출부를 다시 점검한다.

- [ ] **Step 4.2: 로컬 dev에서 시각 확인 (선택)**

Run: `pnpm dev`
브라우저에서 `localhost:3000`으로 진입 후:
- 그룹 생성 → 투표 시작 → 시간 선택 → 저장 → status line "✓ 내 투표 저장됨 · 시간 N구간 선택" 표시 확인
- 좌측 버튼 "투표 수정하기" outlined 스타일 확인
- 우측 버튼 "N명 중 M명 투표 중" 표시 확인
- 다크모드 토글 시 색상 정상 표시 확인

dev 서버는 백그라운드에서 띄우고 시각 확인이 끝나면 종료한다.

---

## 완료 기준 (Definition of Done)

- [ ] `pnpm typecheck` 통과
- [ ] `pnpm lint` 통과
- [ ] `pnpm test` 통과 (countVotedParticipants 4 케이스 포함)
- [ ] `pnpm build` 통과
- [ ] 2개 커밋 (Task 1, Task 3)이 master에 올라감
- [ ] 시각 확인: status line · 좌측 outlined · 우측 진행률 라벨 모두 정상
