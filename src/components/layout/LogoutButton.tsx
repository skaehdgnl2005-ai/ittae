"use client";

import { useTransition } from "react";
import { signOut } from "@/app/login/actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="로그아웃"
      disabled={isPending}
      onClick={() => startTransition(() => signOut())}
      className="min-h-11 min-w-11 px-3 py-2 text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >
      {isPending ? "..." : "로그아웃"}
    </button>
  );
}
