import type { Database } from "@/types/supabase";
import type { Schedule, Group, User, VoteSession, Vote, Memory, TimeSlot } from "@/types";

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

export function mapVoteSession(
  row: Database["public"]["Tables"]["vote_sessions"]["Row"]
): VoteSession {
  return {
    id: row.id,
    groupId: row.group_id,
    candidateDates: row.candidate_dates,
    deadline: row.deadline ?? "",
  };
}

export function mapVote(
  row: Database["public"]["Tables"]["votes"]["Row"]
): Vote {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    date: row.date,
    choice: row.choice as Vote["choice"],
    comment: row.comment,
  };
}

export function mapMemory(
  row: Database["public"]["Tables"]["memories"]["Row"]
): Memory {
  return {
    id: row.id,
    groupId: row.group_id,
    date: row.date,
    placeId: row.place_id ?? "",
    photos: row.photos,
    note: row.note,
    participants: [],
  };
}

export function mapTimeSlot(
  row: { id: string; session_id: string; user_id: string; date: string; start_time: string; end_time: string }
): TimeSlot {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}
