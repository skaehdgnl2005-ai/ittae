"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { FriendList } from "@/components/friends/FriendList";
import { PendingRequestsSection } from "@/components/friends/PendingRequestsSection";
import { SentRequestsDisclosure } from "@/components/friends/SentRequestsDisclosure";
import { AddFriendSheet } from "@/components/friends/AddFriendSheet";
import { cn } from "@/lib/utils";
import type {
  User,
  PendingFriendRequest,
  SentFriendRequest,
} from "@/types";

type FriendsViewProps = {
  friends: User[];
  pendingRequests: PendingFriendRequest[];
  sentRequests: SentFriendRequest[];
  myInviteCode: string;
  myNickname: string;
};

export function FriendsView({
  friends,
  pendingRequests,
  sentRequests,
  myInviteCode,
  myNickname,
}: FriendsViewProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="bg-gray-50 min-h-dvh dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 pt-5 pb-4">
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-gray-100">
          친구
        </h1>
      </div>

      <PendingRequestsSection requests={pendingRequests} />

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

      <SentRequestsDisclosure requests={sentRequests} />

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
  );
}
