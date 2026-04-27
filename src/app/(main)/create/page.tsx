import { createServerClient } from "@/lib/supabase/server";
import { mapUser } from "@/lib/mappers";
import { CreateMeetingForm } from "@/components/create/CreateMeetingForm";
import { mockUsers, mockCurrentUserId } from "@/lib/mock";
import type { User } from "@/types";

export default async function CreatePage() {
  const supabase = await createServerClient();

  // 수락된 친구 id 수집
  const [{ data: sent }, { data: received }] = await Promise.all([
    supabase
      .from("friendships")
      .select("receiver_id")
      .eq("status", "accepted"),
    supabase
      .from("friendships")
      .select("requester_id")
      .eq("status", "accepted"),
  ]);

  const friendIds = [
    ...(sent ?? []).map((f) => f.receiver_id),
    ...(received ?? []).map((f) => f.requester_id),
  ];

  let friends: User[] = [];

  if (friendIds.length > 0) {
    const { data: usersData } = await supabase
      .from("users")
      .select("*")
      .in("id", friendIds);
    friends = (usersData ?? []).map(mapUser);
  }

  // DB에 친구가 없으면 시연용 mock 데이터로 폴백
  if (friends.length === 0) {
    friends = mockUsers.filter((u) => u.id !== mockCurrentUserId);
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-dvh">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 pt-5 pb-4">
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-gray-100">
          모임 만들기
        </h1>
      </div>

      <CreateMeetingForm friends={friends} />
    </div>
  );
}
