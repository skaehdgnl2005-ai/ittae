"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[app/error.tsx]", error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-3">
        <div className="text-4xl font-serif text-gray-800 dark:text-gray-100">!</div>
        <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          잠시 문제가 생겼어요
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          페이지를 다시 불러와 주세요. 계속 안 되면 잠시 후 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 min-h-11 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white active:bg-violet-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
