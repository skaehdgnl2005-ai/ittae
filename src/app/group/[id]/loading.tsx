export default function GroupDetailLoading() {
  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="w-9 h-9" />
        <div className="flex-1 min-w-0">
          <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800/60 mt-1 animate-pulse" />
        </div>
      </div>
      <div className="flex items-center justify-center py-20">
        <div
          className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-violet-600 dark:border-t-violet-400 animate-spin"
          role="status"
          aria-label="불러오는 중"
        />
      </div>
    </div>
  );
}
