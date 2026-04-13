// src/components/friends/FriendsView.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilterChip } from "@/components/friends/FilterChip";
import { GroupCard } from "@/components/friends/GroupCard";
import { FriendList } from "@/components/friends/FriendList";
import { cn } from "@/lib/utils";
import type { User, Group, GroupStatus } from "@/types";

type Tab = "friends" | "groups";
type FilterValue = "all" | GroupStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all",       label: "전체" },
  { value: "voting",    label: "투표 중" },
  { value: "confirmed", label: "확정" },
  { value: "completed", label: "완료" },
];

type FriendsViewProps = {
  friends: User[];
  groups: Group[];
};

export function FriendsView({ friends, groups }: FriendsViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("friends");
  const [filter, setFilter] = useState<FilterValue>("all");

  const filteredGroups = filter === "all"
    ? groups
    : groups.filter((g) => g.status === filter);

  return (
    <div className="bg-gray-50 min-h-dvh dark:bg-gray-950">
      {/* 탭 */}
      <div role="tablist" className="flex bg-white border-b border-gray-200 px-5 dark:bg-gray-900 dark:border-gray-800">
        {(["friends", "groups"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t
                ? "border-violet-600 text-violet-600 dark:text-violet-400"
                : "border-transparent text-gray-400 dark:text-gray-500"
            )}
          >
            {t === "friends" ? "친구" : "모임"}
          </button>
        ))}
      </div>

      {tab === "friends" ? (
        <FriendList users={friends} />
      ) : (
        <div>
          {/* 필터 칩 */}
          <div className="flex gap-2 px-5 py-3 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => (
              <FilterChip
                key={f.value}
                value={f.value}
                label={f.label}
                selected={filter === f.value}
                onSelect={setFilter}
              />
            ))}
          </div>
          {/* 그룹 목록 */}
          <div className="px-5 space-y-3 pb-6">
            {filteredGroups.map((g) => (
              <GroupCard key={g.id} group={g} onClick={() => router.push(`/group/${g.id}`)} />
            ))}
            {filteredGroups.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">모임이 없습니다</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
