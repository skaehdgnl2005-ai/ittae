// src/components/friends/FriendList.tsx
"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type FriendListProps = {
  users: User[];
};

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export function FriendList({ users }: FriendListProps) {
  const [query, setQuery] = useState("");

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
  }

  const filtered = users.filter((u) =>
    u.nickname.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      {/* 검색바 */}
      <div className="px-5 py-3">
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            aria-label="친구 검색"
            placeholder="친구 검색"
            className={cn(
              "w-full pl-9 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm",
              "outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white transition-all",
              "dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900"
            )}
          />
        </div>
      </div>

      {/* 친구 목록 */}
      <motion.div variants={container} initial="hidden" animate="show" className="px-5 space-y-1 mt-1">
        {filtered.map((user, idx) => (
          <motion.div key={user.id} variants={itemVariants}>
            <div className="flex items-center gap-3 min-h-11 py-2">
              <Avatar nickname={user.nickname} profileImageUrl={user.profileImageUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{user.nickname}</p>
                {user.statusMessage && (
                  <p className="text-xs text-gray-400 truncate">{user.statusMessage}</p>
                )}
              </div>
            </div>
            {idx < filtered.length - 1 && (
              <div className="h-px bg-gray-100 dark:bg-gray-700 ml-14" />
            )}
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">
            {users.length === 0
              ? "아직 친구가 없어요. 우측 상단 버튼으로 친구를 초대해보세요."
              : "검색 결과 없음"}
          </p>
        )}
      </motion.div>
    </div>
  );
}
