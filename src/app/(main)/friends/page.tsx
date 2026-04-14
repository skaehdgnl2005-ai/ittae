import { createServerClient } from "@/lib/supabase/server";
import { mapUser, mapGroup } from "@/lib/mappers";
import { FriendsView } from "@/components/friends/FriendsView";
import { mockUsers, mockGroups, mockCurrentUserId } from "@/lib/mock";
import type { User, Group } from "@/types";

export default async function FriendsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // 테스트용: 로그인 없이 mock 데이터 표시
    const mockFriends = mockUsers.filter((u) => u.id !== mockCurrentUserId);
    return <FriendsView friends={mockFriends} groups={mockGroups} />;
  }

  // Fetch accepted friends
  const [{ data: sent }, { data: received }] = await Promise.all([
    supabase
      .from("friendships")
      .select("receiver_id")
      .eq("requester_id", user.id)
      .eq("status", "accepted"),
    supabase
      .from("friendships")
      .select("requester_id")
      .eq("receiver_id", user.id)
      .eq("status", "accepted"),
  ]);

  const friendIds = [
    ...(sent ?? []).map((f) => f.receiver_id),
    ...(received ?? []).map((f) => f.requester_id),
  ];

  const friendsPromise = friendIds.length > 0
    ? supabase.from("users").select("*").in("id", friendIds)
    : Promise.resolve({ data: [] as { id: string; email: string; nickname: string; profile_image_url: string | null; status_message: string | null; created_at: string }[] });

  // Fetch groups where user is a member
  const membershipsPromise = supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  const [{ data: usersData }, { data: myMemberships }] = await Promise.all([
    friendsPromise,
    membershipsPromise,
  ]);

  const friends: User[] = (usersData ?? []).map(mapUser);

  const groupIds = (myMemberships ?? []).map((m) => m.group_id);

  let groups: Group[] = [];

  if (groupIds.length > 0) {
    const { data: groupRows } = await supabase
      .from("groups")
      .select("*")
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    const { data: allMemberships } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds);

    const allMemberIds = [...new Set((allMemberships ?? []).map((m) => m.user_id))];
    const { data: allUsers } = await supabase
      .from("users")
      .select("*")
      .in("id", allMemberIds);

    const userMap = Object.fromEntries(
      (allUsers ?? []).map((u) => [u.id, mapUser(u)])
    );

    const membersByGroup = (allMemberships ?? []).reduce<Record<string, User[]>>(
      (acc, m) => {
        if (!acc[m.group_id]) acc[m.group_id] = [];
        const member = userMap[m.user_id];
        if (member) acc[m.group_id].push(member);
        return acc;
      },
      {}
    );

    groups = (groupRows ?? []).map((row) => ({
      ...mapGroup(row),
      members: membersByGroup[row.id] ?? [],
    }));
  }

  // 테스트용: 실제 친구가 없으면 mock 데이터로 폴백
  if (friends.length === 0 && groups.length === 0) {
    const mockFriends = mockUsers.filter((u) => u.id !== mockCurrentUserId);
    return <FriendsView friends={mockFriends} groups={mockGroups} />;
  }

  return <FriendsView friends={friends} groups={groups} />;
}
