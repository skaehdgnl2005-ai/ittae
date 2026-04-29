export default function MainLoading() {
  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div
        className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-violet-600 dark:border-t-violet-400 animate-spin"
        role="status"
        aria-label="불러오는 중"
      />
    </div>
  );
}
