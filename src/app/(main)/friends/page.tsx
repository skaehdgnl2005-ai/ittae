import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapUser, mapPublicUser } from "@/lib/mappers";
import { FriendsView } from "@/components/friends/FriendsView";
import type {
  User,
  PendingFriendRequest,
  SentFriendRequest,
} from "@/types";
import type { Database } from "@/types/supabase";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
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
        pendingRequests={[]}
        sentRequests={[]}
        myInviteCode=""
        myNickname=""
      />
    );
  }

  // Stage 1: user.id만 있으면 되는 모든 쿼리를 한 번에 발사.
  const [
    { data: me },
    { data: receivedPending },
    { data: sentPending },
    { data: sent },
    { data: received },
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
      .select("receiver_id, created_at")
      .eq("requester_id", user.id)
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
  ]);

  const myInviteCode = me?.invite_code ?? "";
  const myNickname = me?.nickname ?? "";

  const friendIds = [
    ...(sent ?? []).map((f) => f.receiver_id),
    ...(received ?? []).map((f) => f.requester_id),
  ];
  const requesterIds = (receivedPending ?? []).map((r) => r.requester_id);
  const receiverIds = (sentPending ?? []).map((r) => r.receiver_id);

  // Stage 2: stage 1 결과에 의존하는 쿼리.
  // requester/receiver는 RLS상 친구가 아닌 경우 안 보이므로 admin client로.
  const admin =
    requesterIds.length + receiverIds.length > 0 ? createAdminClient() : null;

  const [friendsRes, requestersRes, receiversRes] = await Promise.all([
    friendIds.length > 0
      ? supabase.from("users").select("*").in("id", friendIds)
      : Promise.resolve(emptyResult<UserRow>()),
    admin && requesterIds.length > 0
      ? admin
          .from("users")
          .select("id, nickname, profile_image_url, status_message")
          .in("id", requesterIds)
      : Promise.resolve(emptyResult<RequesterRow>()),
    admin && receiverIds.length > 0
      ? admin
          .from("users")
          .select("id, nickname, profile_image_url, status_message")
          .in("id", receiverIds)
      : Promise.resolve(emptyResult<RequesterRow>()),
  ]);

  const friendsData = (friendsRes.data ?? []) as UserRow[];
  const requesters = (requestersRes.data ?? []) as RequesterRow[];
  const receivers = (receiversRes.data ?? []) as RequesterRow[];

  const friends: User[] = friendsData.map(mapUser);

  const requesterMap = new Map(
    requesters.map((u) => [u.id, mapPublicUser(u)])
  );

  const receiverMap = new Map(
    receivers.map((u) => [u.id, mapPublicUser(u)])
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

  const sentRequests: SentFriendRequest[] = (sentPending ?? [])
    .map((r) => {
      const pu = receiverMap.get(r.receiver_id);
      if (!pu) return null;
      return {
        receiverId: r.receiver_id,
        receiver: pu,
        createdAt: r.created_at,
      };
    })
    .filter((x): x is SentFriendRequest => x !== null);

  return (
    <FriendsView
      friends={friends}
      pendingRequests={pendingRequests}
      sentRequests={sentRequests}
      myInviteCode={myInviteCode}
      myNickname={myNickname}
    />
  );
}
