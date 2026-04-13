type BestDateBannerProps = {
  date: string | null;
};

export function BestDateBanner({ date }: BestDateBannerProps) {
  if (!date) return null;
  return (
    <div className="mx-5 my-3 bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center gap-2 dark:bg-violet-900/20 dark:border-violet-800">
      <span aria-hidden="true" className="text-violet-600 text-sm">⭐</span>
      <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
        <span className="font-semibold">{date}</span>에 가장 많이 가능해요
      </p>
    </div>
  );
}
