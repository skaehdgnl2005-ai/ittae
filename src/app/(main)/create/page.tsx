import { createServerClient } from "@/lib/supabase/server";
import { mapUser, mapGroup } from "@/lib/mappers";
import { GroupsView } from "@/components/groups/GroupsView";
import type { Group, User } from "@/types";
import type { Database } from "@/types/supabase";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupMemberRow = { group_id: string; user_id: string };

function emptyResult<T>(): { data: T[] | null } {
  return { data: null };
}

export default async function GroupsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <GroupsView groups={[]} />;
  }

  const { data: myMemberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  const groupIds = (myMemberships ?? []).map((m) => m.group_id);

  if (groupIds.length === 0) {
    return <GroupsView groups={[]} />;
  }

  const [groupRowsRes, allMembershipsRes] = await Promise.all([
    supabase
      .from("groups")
      .select("*")
      .in("id", groupIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds),
  ]);

  const groupRows = (groupRowsRes.data ?? []) as GroupRow[];
  const allMemberships = (allMembershipsRes.data ?? []) as GroupMemberRow[];

  const allMemberIds = [...new Set(allMemberships.map((m) => m.user_id))];

  const { data: allUsers } =
    allMemberIds.length > 0
      ? await supabase.from("users").select("*").in("id", allMemberIds)
      : emptyResult<Database["public"]["Tables"]["users"]["Row"]>();

  const userMap = Object.fromEntries(
    (allUsers ?? []).map((u) => [u.id, mapUser(u)] as const)
  ) as Record<string, User>;

  const membersByGroup = allMemberships.reduce<Record<string, User[]>>(
    (acc, m) => {
      if (!acc[m.group_id]) acc[m.group_id] = [];
      const member = userMap[m.user_id];
      if (member) acc[m.group_id].push(member);
      return acc;
    },
    {}
  );

  const groups: Group[] = groupRows.map((row) => ({
    ...mapGroup(row),
    members: membersByGroup[row.id] ?? [],
  }));

  return <GroupsView groups={groups} />;
}
