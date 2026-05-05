import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { code } = await params;
  const admin = createAdminClient();

  // confirmed_start_time / confirmed_end_time은 supabase types에 아직 없을 수 있어 (any) 캐스팅 사용.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: group, error } = await (admin as any)
    .from("groups")
    .select("id, name, status, confirmed_date, confirmed_start_time, confirmed_end_time")
    .eq("invite_code", code)
    .maybeSingle();

  if (error || !group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      groupId: group.id,
      name: group.name,
      status: group.status,
      confirmedDate: group.confirmed_date ?? null,
      confirmedStartTime: group.confirmed_start_time ?? null,
      confirmedEndTime: group.confirmed_end_time ?? null,
    },
  });
}
