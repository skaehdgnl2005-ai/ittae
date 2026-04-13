"use client";
import { Share2 } from "lucide-react";

type KakaoShareButtonProps = {
  place: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
};

declare const window: Window & {
  Kakao?: {
    Share: {
      sendDefault: (options: {
        objectType: string;
        content: {
          title: string;
          description: string;
          imageUrl?: string;
          link: { mobileWebUrl: string; webUrl: string };
        };
      }) => void;
    };
  };
};

export function KakaoShareButton({ place }: KakaoShareButtonProps) {
  const handleShare = () => {
    if (typeof window === "undefined" || !window.Kakao?.Share) return;

    const mapLink = `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.latitude},${place.longitude}`;

    window.Kakao.Share.sendDefault({
      objectType: "location",
      content: {
        title: place.name,
        description: place.address,
        link: {
          mobileWebUrl: mapLink,
          webUrl: mapLink,
        },
      },
    });
  };

  return (
    <button
      onClick={handleShare}
      aria-label={`${place.name} 카카오톡으로 공유`}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium min-h-11 min-w-11 transition-colors hover:bg-violet-700 active:bg-violet-800"
    >
      <Share2 size={16} />
      카카오톡 공유
    </button>
  );
}
