"use client";

import { useEffect, useState } from "react";
import { guestFetch } from "@/lib/api/guest";
import type { Vote, TimeSlot } from "@/types";

/**
 * 게스트 화면용 — 5초 polling으로 다른 참여자(회원/다른 게스트) 변경을 반영한다.
 * v1: anon Realtime 채널 RLS 복잡성을 피하기 위해 polling 사용.
 * v1.5: 정식 Realtime 구독으로 교체 검토.
 */
export function useGuestRealtime(
  code: string,
  token: string | null,
  initialVotes: Vote[],
  initialTimeSlots: TimeSlot[]
): { votes: Vote[]; timeSlots: TimeSlot[] } {
  const [votes, setVotes] = useState(initialVotes);
  const [timeSlots, setTimeSlots] = useState(initialTimeSlots);

  useEffect(() => {
    if (!code || !token) return;

    const interval = setInterval(async () => {
      try {
        const res = await guestFetch(`/api/invite/${code}/state`, {
          method: "GET",
          token,
        });
        if (!res.ok) return;
        const json = await res.json();
        setVotes(json.data.votes);
        setTimeSlots(json.data.timeSlots);
      } catch {
        // network blip — 다음 tick에 재시도
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [code, token]);

  return { votes, timeSlots };
}
