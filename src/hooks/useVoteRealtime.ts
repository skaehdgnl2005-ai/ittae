"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { mapVote } from "@/lib/mappers";
import type { Vote } from "@/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type VoteRow = Database["public"]["Tables"]["votes"]["Row"];

export function useVoteRealtime(
  sessionId: string,
  initialVotes: Vote[]
): Vote[] {
  const [votes, setVotes] = useState<Vote[]>(initialVotes);

  useEffect(() => {
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`votes:${sessionId}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return votes;
}
