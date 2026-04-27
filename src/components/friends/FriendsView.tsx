"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { FilterChip } from "@/components/friends/FilterChip";
import { GroupCard } from "@/components/friends/GroupCard";
import { FriendList } from "@/components/friends/FriendList";
import { PendingRequestsSection } from "@/components/friends/PendingRequestsSection";
import { AddFriendSheet } from "@/components/friends/AddFriendSheet";
import { cn } from "@/lib/utils";
import type {
  User,
  Group,
  GroupStatus,
  PendingFriendRequest,
} from "@/types";

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
  pendingRequests: PendingFriendRequest[];
  myInviteCode: string;
  myNickname: string;
};

export function FriendsView({
  friends,
  groups,
  pendingRequests,
  myInviteCode,
  myNickname,
}: FriendsViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("friends");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

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
        <div>
          <PendingRequestsSection requests={pendingRequests} />

          {/* 친구 추가 진입점 — 검색바 우측 + 버튼 */}
          <div className="px-5 pt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="친구 추가"
              className={cn(
                "min-h-11 min-w-11 flex items-center justify-center",
                "rounded-full bg-violet-600 text-white active:bg-violet-700"
              )}
            >
              <UserPlus size={18} />
            </button>
          </div>

          <FriendList users={friends} />

          <AddFriendSheet
            open={sheetOpen}
            onClose={() => {
              setSheetOpen(false);
              router.refresh();
            }}
            myInviteCode={myInviteCode}
            myNickname={myNickname}
          />
        </div>
      ) : (
        <div>
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
