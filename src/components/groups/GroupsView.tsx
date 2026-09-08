"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilterChip } from "@/components/friends/FilterChip";
import { GroupCard } from "@/components/friends/GroupCard";
import { CreateGroupFab } from "@/components/groups/CreateGroupFab";
import type { Group, GroupStatus } from "@/types";

type FilterValue = "all" | GroupStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all",       label: "전체" },
  { value: "voting",    label: "투표 중" },
  { value: "confirmed", label: "확정" },
  { value: "completed", label: "완료" },
];

type GroupsViewProps = {
  groups: Group[];
};

export function GroupsView({ groups }: GroupsViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterValue>("all");

  const filteredGroups =
    filter === "all" ? groups : groups.filter((g) => g.status === filter);

  return (
    <div className="bg-gray-50 min-h-dvh dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 pt-5 pb-4">
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-gray-100">
          내 모임
        </h1>
      </div>

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

      <div className="px-5 space-y-3 pb-24">
        {filteredGroups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            onClick={() => router.push(`/group/${g.id}`)}
          />
        ))}
        {filteredGroups.length === 0 && (
          <p className="text-sm text-gray-400 py-8 text-center">
            모임이 없습니다
          </p>
        )}
      </div>

      <CreateGroupFab />
    </div>
  );
}
