import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth";

type SavePlaceBody = {
  kakaoPlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categoryCode?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body: SavePlaceBody = await request.json();

  if (!body.kakaoPlaceId || !body.name) {
    return NextResponse.json(
      { error: "kakaoPlaceId and name are required" },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("places")
    .upsert(
      {
        kakao_place_id: body.kakaoPlaceId,
        name: body.name,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        category: body.categoryCode ?? null,
      },
      { onConflict: "kakao_place_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
