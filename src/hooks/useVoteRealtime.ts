"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { mapVote, mapTimeSlot } from "@/lib/mappers";
import type { Vote, TimeSlot } from "@/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type VoteRow = Database["public"]["Tables"]["votes"]["Row"];

export function useVoteRealtime(
  sessionId: string,
  initialVotes: Vote[],
  initialTimeSlots: TimeSlot[] = []
): { votes: Vote[]; timeSlots: TimeSlot[] } {
  const [votes, setVotes] = useState<Vote[]>(initialVotes);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(initialTimeSlots);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`vote-all:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<VoteRow>) => {
          if (payload.eventType === "INSERT") {
            setVotes((prev) => [...prev, mapVote(payload.new)]);
          } else if (payload.eventType === "UPDATE") {
            setVotes((prev) =>
              prev.map((v) =>
                v.id === payload.new.id ? mapVote(payload.new) : v
              )
            );
          } else if (payload.eventType === "DELETE") {
            setVotes((prev) =>
              prev.filter((v) => v.id !== payload.old.id)
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_slots",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as { id: string; session_id: string; user_id: string; date: string; start_time: string; end_time: string };
            setTimeSlots((prev) => [...prev, mapTimeSlot(row)]);
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setTimeSlots((prev) =>
              prev.filter((s) => s.id !== old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { votes, timeSlots };
}
