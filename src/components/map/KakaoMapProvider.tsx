"use client";
import { createContext, useContext, useEffect, useState } from "react";

declare const window: Window & {
  kakao: { maps: { load: (cb: () => void) => void } };
};

type KakaoMapContextValue = { isLoaded: boolean };
const KakaoMapContext = createContext<KakaoMapContextValue>({ isLoaded: false });

export function useKakaoMap() {
  return useContext(KakaoMapContext);
}

export function KakaoMapProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

  useEffect(() => {
    if (!apiKey || isLoaded) return;

    // 이미 로드된 경우
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => setIsLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    script.async = true;
    script.referrerPolicy = "no-referrer";

    script.onload = () => {
      window.kakao.maps.load(() => setIsLoaded(true));
    };

    script.onerror = (e) => {
      console.error("[KakaoMap] SDK load failed:", e);
    };

    document.head.appendChild(script);
  }, [apiKey, isLoaded]);

  return (
    <KakaoMapContext.Provider value={{ isLoaded }}>
      {children}
    </KakaoMapContext.Provider>
  );
}
