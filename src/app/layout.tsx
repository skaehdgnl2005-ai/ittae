// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

// OG 메타데이터의 절대 URL 생성 기준.
// 우선순위: NEXT_PUBLIC_SITE_URL → VERCEL_URL → localhost
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "된다 — 모임 일정 앱",
  description: "친구들과 일정을 맞추고 장소를 고르는 소셜 스케줄링 앱",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
