// src/lib/share.ts
"use client";

type KakaoShareWindow = Window & {
  Kakao?: {
    isInitialized?: () => boolean;
    Share?: {
      sendDefault?: (args: unknown) => void;
    };
  };
};

export type ShareResult = "kakao" | "clipboard" | "failed";

export async function shareInviteLink(args: {
  url: string;
  hostNickname: string;
}): Promise<ShareResult> {
  const w = typeof window !== "undefined" ? (window as KakaoShareWindow) : null;

  // 1. Kakao SDK 초기화 + Share 사용 가능하면 카톡 공유
  if (w?.Kakao?.isInitialized?.() && w.Kakao.Share?.sendDefault) {
    try {
      w.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: `${args.hostNickname}님이 된다에 초대했어요`,
          description: "친구 추가하고 같이 모임을 잡아보세요",
          imageUrl: `${location.origin}/og-invite.png`,
          link: { mobileWebUrl: args.url, webUrl: args.url },
        },
        buttons: [
          {
            title: "친구 추가하기",
            link: { mobileWebUrl: args.url, webUrl: args.url },
          },
        ],
      });
      return "kakao";
    } catch (e) {
      console.warn("[share] Kakao 실패, 클립보드 폴백", e);
    }
  }

  // 2. navigator.clipboard 폴백
  try {
    await navigator.clipboard.writeText(args.url);
    return "clipboard";
  } catch (e) {
    console.error("[share] 클립보드 실패", e);
    return "failed";
  }
}
