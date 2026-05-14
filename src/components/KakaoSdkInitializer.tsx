"use client";
import Script from "next/script";

type KakaoWindow = Window & {
  Kakao?: {
    init?: (key: string) => void;
    isInitialized?: () => boolean;
  };
};

const KAKAO_SDK_URL =
  "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";

export function KakaoSdkInitializer() {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) return null;

  return (
    <Script
      src={KAKAO_SDK_URL}
      strategy="afterInteractive"
      onLoad={() => {
        const w = window as KakaoWindow;
        if (w.Kakao?.init && !w.Kakao.isInitialized?.()) {
          w.Kakao.init(key);
        }
      }}
    />
  );
}
