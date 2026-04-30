type Props = {
  needsReauth: boolean;
};

export function ReauthBanner({ needsReauth }: Props) {
  if (!needsReauth) return null;
  return (
    <a
      href="/api/auth/google/connect"
      className="block mx-5 mt-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-sm text-amber-800 dark:text-amber-200"
    >
      ⚠ Google 캘린더 재연결이 필요해요. 탭하여 다시 연결하세요.
    </a>
  );
}
