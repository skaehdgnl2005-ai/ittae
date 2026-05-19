// src/lib/share.ts
"use client";

export type ShareResult = "shared" | "clipboard" | "failed";

type ShareArgs = {
  url: string;
  title: string;
  text: string;
};

async function tryShare({ url, title, text }: ShareArgs): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (e) {
      // 사용자가 시트를 닫은 경우는 클립보드로 폴백하지 않는다 (의도치 않은 덮어쓰기 방지).
      if (e instanceof DOMException && e.name === "AbortError") {
        return "shared";
      }
      console.warn("[share] navigator.share 실패, 클립보드 폴백", e);
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "clipboard";
  } catch (e) {
    console.error("[share] 클립보드 실패", e);
    return "failed";
  }
}

export async function shareInviteLink(args: {
  url: string;
  hostNickname: string;
}): Promise<ShareResult> {
  return tryShare({
    url: args.url,
    title: `${args.hostNickname}님이 된다에 초대했어요`,
    text: "친구 추가하고 같이 모임을 잡아보세요",
  });
}

export async function shareGroupLink(args: {
  url: string;
  groupName: string;
  status: string;
  confirmedDate?: string | null;
  confirmedStartTime?: string | null;
  confirmedEndTime?: string | null;
}): Promise<ShareResult> {
  const isVoting = args.status === "voting";
  const title = isVoting
    ? `${args.groupName} 투표가 도착했어요`
    : `${args.groupName} 일정이 확정됐어요`;

  let text: string;
  if (isVoting) {
    text = "가능한 시간을 골라주세요";
  } else if (
    args.confirmedDate &&
    args.confirmedStartTime &&
    args.confirmedEndTime
  ) {
    text = `${args.confirmedDate} ${args.confirmedStartTime}~${args.confirmedEndTime}`;
  } else {
    text = "확정된 일정을 확인하세요";
  }

  return tryShare({ url: args.url, title, text });
}
