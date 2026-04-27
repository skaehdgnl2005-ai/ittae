type BestTimeBannerProps = {
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  count: number;
  totalMembers: number;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}/${day}(${weekdays[d.getDay()]})`;
}

export function BestTimeBanner({
  date,
  startTime,
  endTime,
  count,
  totalMembers,
}: BestTimeBannerProps) {
  if (!date || !startTime || !endTime) return null;

  const allAvailable = count === totalMembers;

  return (
    <div className="mx-5 my-3 bg-violet-50 border border-violet-200 rounded-xl p-3 dark:bg-violet-900/20 dark:border-violet-800">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-sm">⭐</span>
        <div>
          <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
            {formatDate(date)} {startTime}~{endTime}
          </p>
          <p className="text-xs text-violet-600 dark:text-violet-400">
            {allAvailable ? `${count}명 전원 가능` : `${count}명 가능`}
          </p>
        </div>
      </div>
    </div>
  );
}
