import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-3">
        <div className="text-5xl font-serif text-gray-800 dark:text-gray-100">404</div>
        <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          페이지를 찾지 못했어요
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          링크가 만료되었거나 주소가 정확하지 않아요.
        </p>
        <Link
          href={ROUTES.HOME}
          className="mt-2 min-h-11 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white text-center active:bg-violet-700 transition-colors flex items-center justify-center"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
