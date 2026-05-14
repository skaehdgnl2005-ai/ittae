import type { Database } from "@/types/supabase";
import type { Schedule, Group, User, VoteSession, Vote, TimeSlot, PublicUser, Guest } from "@/types";

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
    source: row.source,
    externalEventId: row.external_event_id,
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
    confirmedStartTime: row.confirmed_start_time,
    confirmedEndTime: row.confirmed_end_time,
    placeId: row.place_id,
    createdAt: row.created_at,
    inviteCode: row.invite_code ?? null,
    members: [],
    guests: [],
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
    guestId: row.guest_id ?? null,
    date: row.date,
    choice: row.choice as Vote["choice"],
    comment: row.comment,
  };
}

export function mapTimeSlot(
  row: {
    id: string;
    session_id: string;
    user_id: string | null;
    guest_id?: string | null;
    date: string;
    start_time: string;
    end_time: string;
  }
): TimeSlot {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    guestId: row.guest_id ?? null,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

type GuestRow = {
  id: string;
  group_id: string;
  nickname: string;
  created_at: string;
};

export function mapGuest(row: GuestRow): Guest {
  return {
    id: row.id,
    groupId: row.group_id,
    nickname: row.nickname,
    createdAt: row.created_at,
  };
}

type PublicUserRow = {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  status_message: string | null;
};

export function mapPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    nickname: row.nickname,
    profileImageUrl: row.profile_image_url,
    statusMessage: row.status_message,
  };
}
