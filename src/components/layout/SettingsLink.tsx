"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { useRequireAuth } from "@/lib/auth-gate";

const CLASS_NAME =
  "h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all min-h-11 min-w-11 text-gray-600 dark:text-gray-400";

type Props = {
  isAuthed: boolean;
};

export function SettingsLink({ isAuthed }: Props) {
  const router = useRouter();
  const requireAuth = useRequireAuth(isAuthed);

  if (isAuthed) {
    return (
      <Link href="/profile" aria-label="프로필 / 설정" className={CLASS_NAME}>
        <Settings size={18} strokeWidth={1.8} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label="프로필 / 설정"
      onClick={() => requireAuth(() => router.push("/profile"))}
      className={CLASS_NAME}
    >
      <Settings size={18} strokeWidth={1.8} />
    </button>
  );
}
