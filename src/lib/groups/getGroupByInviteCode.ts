import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type GroupByInviteCode = {
  id: string;
  name: string;
  status: string;
  confirmed_date: string | null;
  confirmed_start_time: string | null;
  confirmed_end_time: string | null;
};

export const getGroupByInviteCode = cache(
  async (code: string): Promise<GroupByInviteCode | null> => {
    const trimmed = code.trim();
    if (trimmed.length === 0) return null;

    const admin = createAdminClient();
    // confirmed_* 컬럼이 generated types에 누락돼 있어 (any) 캐스팅.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("groups")
      .select(
        "id, name, status, confirmed_date, confirmed_start_time, confirmed_end_time"
      )
      .eq("invite_code", trimmed)
      .maybeSingle();

    return (data as GroupByInviteCode | null) ?? null;
  }
);
