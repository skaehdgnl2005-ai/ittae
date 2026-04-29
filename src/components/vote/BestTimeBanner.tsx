import type { BestTimeResult } from "@/lib/vote";

type BestTimeBannerProps = {
  slots: BestTimeResult[];
  totalMembers: number;
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

export function BestTimeBanner({ slots, totalMembers }: BestTimeBannerProps) {
  if (slots.length === 0) return null;
  const [first, second] = slots;
  const showRanks = slots.length >= 2;

  return (
    <div className="mx-5 my-3 bg-violet-50 border border-violet-200 rounded-xl p-3 dark:bg-violet-900/20 dark:border-violet-800">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-sm leading-5">
          ⭐
        </span>
        <div className="flex-1 min-w-0">
          {showRanks && (
            <p className="text-[11px] font-medium text-violet-500 dark:text-violet-400">
              1순위
            </p>
          )}
          <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
            {formatDate(first.date)} {first.startTime}~{first.endTime}
          </p>
          <p className="text-xs text-violet-600 dark:text-violet-400">
            {countLabel(first.count, totalMembers)}
          </p>
        </div>
      </div>
      {second && (
        <div className="mt-2 pt-2 pl-6 border-t border-violet-200/60 dark:border-violet-800/60">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-medium text-violet-500/90 dark:text-violet-400/90 flex-shrink-0">
              2순위
            </span>
            <p className="text-xs text-violet-700 dark:text-violet-300/90 truncate">
              {formatDate(second.date)} {second.startTime}~{second.endTime}
              <span aria-hidden="true"> · </span>
              {countLabel(second.count, totalMembers)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
