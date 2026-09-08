import Link from "next/link";
import { Plus } from "lucide-react";

export function CreateGroupFab() {
  return (
    <Link
      href="/create/new"
      aria-label="모임 만들기"
      className="fixed right-5 bottom-[99px] z-40 h-14 w-14 rounded-full bg-violet-600 text-white shadow-lg active:bg-violet-700 flex items-center justify-center"
    >
      <Plus size={24} strokeWidth={2} />
    </Link>
  );
}
