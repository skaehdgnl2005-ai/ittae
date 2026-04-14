"use client";
import { createContext, useContext, useState } from "react";
import Script from "next/script";

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

  if (!apiKey) {
    return (
      <KakaoMapContext.Provider value={{ isLoaded: false }}>
        {children}
      </KakaoMapContext.Provider>
    );
  }

  return (
    <KakaoMapContext.Provider value={{ isLoaded }}>
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => {
          window.kakao.maps.load(() => setIsLoaded(true));
        }}
      />
      {children}
    </KakaoMapContext.Provider>
  );
}
