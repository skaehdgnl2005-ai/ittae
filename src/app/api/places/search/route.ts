import { NextRequest, NextResponse } from "next/server";
import type { KakaoPlace } from "@/types";

type KakaoLocalDocument = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  distance: string;
  category_group_code: string;
  phone: string;
};

type KakaoLocalResponse = {
  documents: KakaoLocalDocument[];
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Kakao API key not configured" }, { status: 500 });
  }

  const params = new URLSearchParams({
    query,
    sort: "distance",
    size: "15",
  });

  const categoryGroupCode = searchParams.get("category_group_code");
  if (categoryGroupCode) params.set("category_group_code", categoryGroupCode);

  const x = searchParams.get("x");
  const y = searchParams.get("y");
  if (x) params.set("x", x);
  if (y) params.set("y", y);

  const radius = searchParams.get("radius");
  if (radius) params.set("radius", radius);

  const kakaoUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;

  const kakaoRes = await fetch(kakaoUrl, {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
    },
    next: { revalidate: 0 },
  });

  if (!kakaoRes.ok) {
    return NextResponse.json(
      { error: `Kakao API error: ${kakaoRes.status}` },
      { status: kakaoRes.status }
    );
  }

  const kakaoData: KakaoLocalResponse = await kakaoRes.json();

  const places: KakaoPlace[] = kakaoData.documents.map((doc) => ({
    kakaoPlaceId: doc.id,
    name: doc.place_name,
    address: doc.address_name,
    roadAddress: doc.road_address_name,
    latitude: parseFloat(doc.y),
    longitude: parseFloat(doc.x),
    distance: doc.distance ? parseFloat(doc.distance) : 0,
    categoryCode: doc.category_group_code,
    phone: doc.phone,
  }));

  return NextResponse.json({ data: places });
}
