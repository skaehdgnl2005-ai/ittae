// 사용법:
//   pnpm exec tsx scripts/backfill-invite-codes.ts
// .env.local의 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY를 읽는다.

import { createClient } from "@supabase/supabase-js";
import { generateInviteCode } from "../src/lib/inviteCode";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: groups, error } = await supabase
    .from("groups")
    .select("id")
    .is("invite_code", null);

  if (error) {
    console.error(error);
    process.exit(1);
  }
  if (!groups || groups.length === 0) {
    console.log("백필할 모임 없음");
    return;
  }

  for (const g of groups) {
    let attempt = 0;
    let assigned = false;
    while (attempt < 10) {
      const code = generateInviteCode(8);
      const { error: updError } = await supabase
        .from("groups")
        .update({ invite_code: code })
        .eq("id", g.id)
        .is("invite_code", null);
      if (!updError) {
        console.log(`group ${g.id} -> ${code}`);
        assigned = true;
        break;
      }
      attempt++;
    }
    if (!assigned) {
      console.error(`group ${g.id} 백필 실패 (10회 시도)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
