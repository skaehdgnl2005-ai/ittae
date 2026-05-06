import { cn } from "@/lib/utils";
import type { BestTimeResult } from "@/lib/vote";

type BestTimeBannerProps = {
  slots: BestTimeResult[];
  totalMembers: number;
  /** 제공되면 각 순위 카드가 버튼이 되어 클릭으로 확정 후보를 선택한다 */
  onPickRank?: (slot: BestTimeResult) => void;
  /** 현재 확정 후보로 선택된 슬롯 (시각적 강조용) */
  selectedSlot?: BestTimeResult | null;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}/${day}(${weekdays[d.getDay()]})`;
}

function countLabel(count: number, totalMembers: number): string {
  return count === totalMembers ? `${count}명 전원 가능` : `${count}명 가능`;
}

function isSameSlot(a: BestTimeResult, b: BestTimeResult | null | undefined) {
  if (!b) return false;
  return (
    a.date === b.date && a.startTime === b.startTime && a.endTime === b.endTime
  );
}

export function BestTimeBanner({
  slots,
  totalMembers,
  onPickRank,
  selectedSlot,
}: BestTimeBannerProps) {
  if (slots.length === 0) return null;
  const [first, ...rest] = slots;
  const showRanks = slots.length >= 2;
  const interactive = !!onPickRank;

  return (
    <div className="mx-5 my-3 space-y-2">
      <RankCard
        rank={1}
        slot={first}
        totalMembers={totalMembers}
        showRank={showRanks}
        primary
        interactive={interactive}
        selected={isSameSlot(first, selectedSlot)}
        onPick={onPickRank}
      />
      {rest.map((slot, i) => (
        <RankCard
          key={`${slot.date}-${slot.startTime}-${slot.endTime}`}
          rank={i + 2}
          slot={slot}
          totalMembers={totalMembers}
          showRank
          primary={false}
          interactive={interactive}
          selected={isSameSlot(slot, selectedSlot)}
          onPick={onPickRank}
        />
      ))}
    </div>
  );
}

type RankCardProps = {
  rank: number;
  slot: BestTimeResult;
  totalMembers: number;
  showRank: boolean;
  primary: boolean;
  interactive: boolean;
  selected: boolean;
  onPick?: (slot: BestTimeResult) => void;
};

function RankCard({
  rank,
  slot,
  totalMembers,
  showRank,
  primary,
  interactive,
  selected,
  onPick,
}: RankCardProps) {
  const baseLabel = `${rank}순위 ${formatDate(slot.date)} ${slot.startTime}~${slot.endTime}, ${countLabel(slot.count, totalMembers)}`;

  if (primary) {
    const wrapClass = cn(
      "w-full text-left rounded-xl p-3 border transition-colors",
      selected
        ? "bg-violet-100 border-violet-400 dark:bg-violet-900/40 dark:border-violet-500"
        : "bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800",
      interactive &&
        !selected &&
        "hover:bg-violet-100 dark:hover:bg-violet-900/30 active:scale-[0.99]"
    );
    const inner = (
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-sm leading-5">
          ⭐
        </span>
        <div className="flex-1 min-w-0">
          {showRank && (
            <p className="text-[11px] font-medium text-violet-500 dark:text-violet-400">
              1순위
            </p>
          )}
          <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
            {formatDate(slot.date)} {slot.startTime}~{slot.endTime}
          </p>
          <p className="text-xs text-violet-600 dark:text-violet-400">
            {countLabel(slot.count, totalMembers)}
          </p>
        </div>
      </div>
    );
    return interactive ? (
      <button
        type="button"
        onClick={() => onPick?.(slot)}
        aria-label={baseLabel}
        aria-pressed={selected}
        className={wrapClass}
      >
        {inner}
      </button>
    ) : (
      <div className={wrapClass}>{inner}</div>
    );
  }

  const wrapClass = cn(
    "w-full text-left rounded-xl px-3 py-2 border transition-colors",
    selected
      ? "bg-violet-100 border-violet-300 dark:bg-violet-900/30 dark:border-violet-700"
      : "bg-violet-50/40 border-violet-100 dark:bg-violet-900/10 dark:border-violet-900/50",
    interactive &&
      !selected &&
      "hover:bg-violet-50 dark:hover:bg-violet-900/20 active:scale-[0.99]"
  );
  const inner = (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-medium text-violet-500/90 dark:text-violet-400/90 flex-shrink-0">
        {rank}순위
      </span>
      <p className="text-xs text-violet-700 dark:text-violet-300/90 truncate">
        {formatDate(slot.date)} {slot.startTime}~{slot.endTime}
        <span aria-hidden="true"> · </span>
        {countLabel(slot.count, totalMembers)}
      </p>
    </div>
  );
  return interactive ? (
    <button
      type="button"
      onClick={() => onPick?.(slot)}
      aria-label={baseLabel}
      aria-pressed={selected}
      className={wrapClass}
    >
      {inner}
    </button>
  ) : (
    <div className={wrapClass}>{inner}</div>
  );
}
