import { createServerClient } from "@/lib/supabase/server";
import { mapUser, mapGroup, mapPublicUser } from "@/lib/mappers";
import { FriendsView } from "@/components/friends/FriendsView";
import type { User, Group, PendingFriendRequest } from "@/types";

export default async function FriendsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let friends: User[] = [];
  let groups: Group[] = [];
  let pendingRequests: PendingFriendRequest[] = [];
  let myInviteCode = "";
  let myNickname = "";

  if (user) {
    // 본인 프로필 (invite_code, nickname)
    const { data: me } = await supabase
      .from("users")
      .select("invite_code, nickname")
      .eq("id", user.id)
      .maybeSingle();
    myInviteCode = me?.invite_code ?? "";
    myNickname = me?.nickname ?? "";

    // 받은 pending 요청
    const { data: receivedPending } = await supabase
      .from("friendships")
      .select("requester_id, created_at")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (receivedPending && receivedPending.length > 0) {
      const requesterIds = receivedPending.map((r) => r.requester_id);
      // RLS상 자기/친구만 보이므로, 친구가 아닌 요청자는 안 보일 수 있음.
      // → server side에서만 admin client로 채우기
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: requesters } = await admin
        .from("users")
        .select("id, nickname, profile_image_url, status_message")
        .in("id", requesterIds);

      const requesterMap = new Map(
        (requesters ?? []).map((u) => [u.id, mapPublicUser(u)])
      );

      pendingRequests = receivedPending
        .map((r) => {
          const pu = requesterMap.get(r.requester_id);
          if (!pu) return null;
          return {
            requesterId: r.requester_id,
            requester: pu,
            createdAt: r.created_at,
          };
        })
        .filter((x): x is PendingFriendRequest => x !== null);
    }

    // 기존 accepted friends
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
      : Promise.resolve({ data: [] as never });

    const membershipsPromise = supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    const [{ data: usersData }, { data: myMemberships }] = await Promise.all([
      friendsPromise,
      membershipsPromise,
    ]);

    friends = (usersData ?? []).map(mapUser);

    const groupIds = (myMemberships ?? []).map((m) => m.group_id);

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
  }

  return (
    <FriendsView
      friends={friends}
      groups={groups}
      pendingRequests={pendingRequests}
      myInviteCode={myInviteCode}
      myNickname={myNickname}
    />
  );
}
