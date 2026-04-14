import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      // Google OAuth 아바타
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Kakao OAuth 아바타
      { protocol: "https", hostname: "k.kakaocdn.net" },
      // Supabase Storage (연결 후 실제 URL로 교체)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
