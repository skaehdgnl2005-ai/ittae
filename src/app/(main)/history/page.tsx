import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { mapMemory, mapUser } from "@/lib/mappers";
import { StatsSummary } from "@/components/history/StatsSummary";
import { TimelineView } from "@/components/history/TimelineView";
import { ROUTES } from "@/lib/routes";
import type { Memory, Place, User } from "@/types";

export default async function HistoryPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.LOGIN);

  const { data: myMemberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  const groupIds = (myMemberships ?? []).map((m) => m.group_id);

  let memories: Memory[] = [];
  let places: Place[] = [];

  if (groupIds.length > 0) {
    // memories 최신순 조회
    const { data: memoryRows } = await supabase
      .from("memories")
      .select("*")
      .in("group_id", groupIds)
      .order("date", { ascending: false });

    // 참여자 배치 조회
    const { data: allMemberships } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds);

    const allUserIds = [
      ...new Set((allMemberships ?? []).map((m) => m.user_id)),
    ];

    const { data: allUsers } = await supabase
      .from("users")
      .select("*")
      .in("id", allUserIds);

    const userMap = Object.fromEntries(
      (allUsers ?? []).map((u) => [u.id, mapUser(u)])
    );

    const participantsByGroup = (allMemberships ?? []).reduce<
      Record<string, User[]>
    >((acc, m) => {
      if (!acc[m.group_id]) acc[m.group_id] = [];
      const member = userMap[m.user_id];
      if (member) acc[m.group_id].push(member);
      return acc;
    }, {});

    memories = (memoryRows ?? []).map((row) => ({
      ...mapMemory(row),
      participants: participantsByGroup[row.group_id] ?? [],
    }));

    // 연결된 places 조회
    const placeIds = [
      ...new Set(
        (memoryRows ?? [])
          .map((r) => r.place_id)
          .filter((id): id is string => id !== null)
      ),
    ];

    if (placeIds.length > 0) {
      const { data: placeRows } = await supabase
        .from("places")
        .select("*")
        .in("id", placeIds);

      places = (placeRows ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address ?? "",
        latitude: p.latitude ?? 0,
        longitude: p.longitude ?? 0,
        category: (p.category as Place["category"]) ?? "FD6",
        rating: p.rating ?? 0,
        imageUrl: p.image_url,
      }));
    }
  }

  return (
    <div className="bg-gray-50 min-h-dvh">
      <StatsSummary memories={memories} />
      <TimelineView memories={memories} places={places} />
    </div>
  );
}
