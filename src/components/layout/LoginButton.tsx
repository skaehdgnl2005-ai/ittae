import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function LoginButton() {
  return (
    <Link
      href={ROUTES.LOGIN}
      aria-label="로그인"
      className="min-h-11 min-w-11 px-3 py-2 text-[13px] text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors flex items-center justify-center"
    >
      로그인
    </Link>
  );
}
