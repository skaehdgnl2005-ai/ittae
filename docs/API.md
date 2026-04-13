# Kakao API 연동 가이드

## 필요한 API

| API | 용도 | 키 |
|-----|------|-----|
| Kakao Maps SDK | 지도 렌더링 | JavaScript 앱 키 |
| Kakao Local API | 장소 검색 | REST API 키 |
| Kakao Share API | 카카오톡 공유 | JavaScript 앱 키 |

## 환경 변수

```env
# .env.local
NEXT_PUBLIC_KAKAO_JS_KEY=발급받은_JavaScript_키
KAKAO_REST_KEY=발급받은_REST_API_키
```

- `NEXT_PUBLIC_KAKAO_JS_KEY`: 클라이언트에서 Maps/Share SDK 로딩용
- `KAKAO_REST_KEY`: 서버(Route Handler)에서 Local API 호출용. 클라이언트 노출 금지.

## Maps SDK 로딩

```typescript
// src/lib/kakao/KakaoMapProvider.tsx
"use client";

import Script from "next/script";
import { createContext, useContext, useState } from "react";

const KakaoContext = createContext(false);
export const useKakaoLoaded = () => useContext(KakaoContext);

export function KakaoMapProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <KakaoContext.Provider value={loaded}>
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&libraries=services&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => {
          window.kakao.maps.load(() => setLoaded(true));
        }}
      />
      {children}
    </KakaoContext.Provider>
  );
}
```

## Local API (장소 검색)

```typescript
// src/app/api/places/search/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");
  const x = request.nextUrl.searchParams.get("x"); // 경도
  const y = request.nextUrl.searchParams.get("y"); // 위도
  const radius = request.nextUrl.searchParams.get("radius") || "1000";

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${query}&x=${x}&y=${y}&radius=${radius}&size=15&sort=distance`,
    {
      headers: {
        Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}`,
      },
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}
```

### 카테고리 코드

| 코드 | 카테고리 | 필터 칩 라벨 |
|------|---------|-------------|
| FD6 | 음식점 | 맛집 |
| CE7 | 카페 | 카페 |
| SW8 | 지하철역 | (내부 참조용) |
| CT1 | 문화시설 | 활동 |
| AT4 | 관광명소 | 놀거리 |

## Share API (카카오톡 공유)

```typescript
// src/lib/kakao/share.ts
export function sharePlace(place: {
  name: string;
  address: string;
  lat: number;
  lng: number;
  imageUrl?: string;
}) {
  if (!window.Kakao?.Share) return;

  window.Kakao.Share.sendDefault({
    objectType: "location",
    address: place.address,
    addressTitle: place.name,
    content: {
      title: place.name,
      description: place.address,
      imageUrl: place.imageUrl || "",
      link: {
        mobileWebUrl: window.location.href,
        webUrl: window.location.href,
      },
    },
    social: {
      likeCount: 0,
      commentCount: 0,
    },
  });
}
```

## 중간 지점 계산 (P1)

참여자들의 위치 중간 지점을 계산하여 장소 검색의 중심으로 사용:

```typescript
function getMidpoint(coords: { lat: number; lng: number }[]) {
  const sum = coords.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: sum.lat / coords.length,
    lng: sum.lng / coords.length,
  };
}
```

## TypeScript 타입

```typescript
// src/types/kakao.d.ts
declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: MapOptions) => KakaoMap;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        Marker: new (options: MarkerOptions) => KakaoMarker;
        Circle: new (options: CircleOptions) => KakaoCircle;
        services: {
          Places: new () => KakaoPlaces;
        };
      };
      Share: {
        sendDefault: (options: ShareOptions) => void;
      };
    };
    Kakao: {
      init: (key: string) => void;
      Share: typeof window.kakao.Share;
    };
  }
}
```
