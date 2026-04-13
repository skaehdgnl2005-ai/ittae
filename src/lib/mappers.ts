import type { Database } from "@/types/supabase";
import type { Schedule, Group, User } from "@/types";

export function mapSchedule(
  row: Database["public"]["Tables"]["schedules"]["Row"]
): Schedule {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    date: row.date,
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    memo: row.memo,
    type: "personal",
  };
}

export function mapGroup(
  row: Database["public"]["Tables"]["groups"]["Row"]
): Group {
  return {
    id: row.id,
    name: row.name,
    hostId: row.host_id,
    status: row.status,
    confirmedDate: row.confirmed_date,
    placeId: row.place_id,
    createdAt: row.created_at,
    members: [],
  };
}

export function mapUser(
  row: Database["public"]["Tables"]["users"]["Row"]
): User {
  return {
    id: row.id,
    nickname: row.nickname,
    profileImageUrl: row.profile_image_url,
    statusMessage: row.status_message,
  };
}
