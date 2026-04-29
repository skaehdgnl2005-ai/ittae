import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapUser, mapGroup, mapPublicUser } from "@/lib/mappers";
import { FriendsView } from "@/components/friends/FriendsView";
import type { User, Group, PendingFriendRequest } from "@/types";
import type { Database } from "@/types/supabase";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupMemberRow = { group_id: string; user_id: string };
type RequesterRow = {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  status_message: string | null;
};

function emptyResult<T>(): { data: T[] | null } {
  return { data: null };
}

export default async function FriendsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <FriendsView
        friends={[]}
        groups={[]}
        pendingRequests={[]}
        myInviteCode=""
        myNickname=""
      />
    );
  }

  // Stage 1: user.id만 있으면 되는 모든 쿼리를 한 번에 발사.
  // 이전엔 직렬 await으로 4번 RTT가 깔렸음 → 1번으로 압축.
  const [
    { data: me },
    { data: receivedPending },
    { data: sent },
    { data: received },
    { data: myMemberships },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("invite_code, nickname")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("friendships")
      .select("requester_id, created_at")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
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
    supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id),
  ]);

  const myInviteCode = me?.invite_code ?? "";
  const myNickname = me?.nickname ?? "";

  const friendIds = [
    ...(sent ?? []).map((f) => f.receiver_id),
    ...(received ?? []).map((f) => f.requester_id),
  ];
  const groupIds = (myMemberships ?? []).map((m) => m.group_id);
  const requesterIds = (receivedPending ?? []).map((r) => r.requester_id);

  // Stage 2: stage 1 결과에 의존하는 모든 쿼리를 한 번에 발사.
  // requester는 RLS상 친구가 아닌 경우 안 보이므로 admin client로.
  const admin = requesterIds.length > 0 ? createAdminClient() : null;

  const [
    friendsRes,
    requestersRes,
    groupRowsRes,
    allMembershipsRes,
  ] = await Promise.all([
    friendIds.length > 0
      ? supabase.from("users").select("*").in("id", friendIds)
      : Promise.resolve(emptyResult<UserRow>()),
    admin
      ? admin
          .from("users")
          .select("id, nickname, profile_image_url, status_message")
          .in("id", requesterIds)
      : Promise.resolve(emptyResult<RequesterRow>()),
    groupIds.length > 0
      ? supabase
          .from("groups")
          .select("*")
          .in("id", groupIds)
          .order("created_at", { ascending: false })
      : Promise.resolve(emptyResult<GroupRow>()),
    groupIds.length > 0
      ? supabase
          .from("group_members")
          .select("group_id, user_id")
          .in("group_id", groupIds)
      : Promise.resolve(emptyResult<GroupMemberRow>()),
  ]);

  const friendsData = (friendsRes.data ?? []) as UserRow[];
  const requesters = (requestersRes.data ?? []) as RequesterRow[];
  const groupRows = (groupRowsRes.data ?? []) as GroupRow[];
  const allMemberships = (allMembershipsRes.data ?? []) as GroupMemberRow[];

  const friends: User[] = friendsData.map(mapUser);

  const requesterMap = new Map(
    requesters.map((u) => [u.id, mapPublicUser(u)])
  );

  const pendingRequests: PendingFriendRequest[] = (receivedPending ?? [])
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

  // Stage 3: 그룹 멤버 프로필 조회 (allMemberships 결과에 의존).
  let groups: Group[] = [];
  if (groupRows.length > 0) {
    const allMemberIds = [...new Set(allMemberships.map((m) => m.user_id))];

    const { data: allUsers } =
      allMemberIds.length > 0
        ? await supabase.from("users").select("*").in("id", allMemberIds)
        : { data: null };

    const userMap = Object.fromEntries(
      (allUsers ?? []).map((u) => [u.id, mapUser(u)])
    );

    const membersByGroup = allMemberships.reduce<Record<string, User[]>>(
      (acc, m) => {
        if (!acc[m.group_id]) acc[m.group_id] = [];
        const member = userMap[m.user_id];
        if (member) acc[m.group_id].push(member);
        return acc;
      },
      {}
    );

    groups = groupRows.map((row) => ({
      ...mapGroup(row),
      members: membersByGroup[row.id] ?? [],
    }));
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
