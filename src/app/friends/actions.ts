"use server";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapPublicUser } from "@/lib/mappers";
import type {
  PublicUser,
  UserSearchResult,
  RelationshipStatus,
} from "@/types";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SEARCH_LIMIT = 20;

export async function searchUsersByNickname(
  query: string
): Promise<Result<UserSearchResult[]>> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { ok: true, data: [] };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();

  // ILIKE %query% 매칭, 자기 자신 제외, limit
  const escaped = trimmed.replace(/[%_]/g, (m) => `\\${m}`);
  const { data: rows, error } = await admin
    .from("users")
    .select("id, nickname, profile_image_url, status_message")
    .ilike("nickname", `%${escaped}%`)
    .neq("id", user.id)
    .limit(SEARCH_LIMIT);

  if (error) {
    console.error("[searchUsersByNickname]", error);
    return { ok: false, error: "검색에 실패했습니다." };
  }

  const candidates = (rows ?? []).map(mapPublicUser);

  if (candidates.length === 0) {
    return { ok: true, data: [] };
  }

  // friendships 한 번 조회로 relationship 주석
  const ids = candidates.map((u) => u.id);
  const { data: rels } = await admin
    .from("friendships")
    .select("requester_id, receiver_id, status")
    .or(
      `and(requester_id.eq.${user.id},receiver_id.in.(${ids.join(",")})),and(receiver_id.eq.${user.id},requester_id.in.(${ids.join(",")}))`
    );

  const relMap = new Map<string, RelationshipStatus>();
  for (const r of rels ?? []) {
    const otherId = r.requester_id === user.id ? r.receiver_id : r.requester_id;
    if (r.status === "accepted") {
      relMap.set(otherId, "accepted");
    } else if (r.status === "pending") {
      relMap.set(
        otherId,
        r.requester_id === user.id ? "pending_sent" : "pending_received"
      );
    }
  }

  const data: UserSearchResult[] = candidates.map((u: PublicUser) => ({
    ...u,
    relationship: relMap.get(u.id) ?? "none",
  }));

  return { ok: true, data };
}
