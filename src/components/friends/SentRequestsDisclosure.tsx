"use client";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { SentFriendRequest } from "@/types";

type Props = {
  requests: SentFriendRequest[];
};

export function SentRequestsDisclosure({ requests }: Props) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (requests.length === 0) return null;

  return (
    <section className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={cn(
          "min-h-11 w-full flex items-center gap-1.5",
          "text-xs text-gray-400 dark:text-gray-500"
        )}
      >
        <ChevronDown
          size={14}
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn(
            "transition-transform",
            expanded ? "rotate-0" : "-rotate-90"
          )}
        />
        <span>보낸 요청 {requests.length}건</span>
      </button>

      {expanded && (
        <div id={panelId} className="mt-2 space-y-1.5">
          {requests.map((r) => (
            <div
              key={r.receiverId}
              className="flex items-center gap-3 min-h-11 py-1"
            >
              <Avatar
                nickname={r.receiver.nickname}
                profileImageUrl={r.receiver.profileImageUrl}
                size="sm"
                className="opacity-80"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {r.receiver.nickname}
                </p>
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[10px]",
                  "bg-gray-100 text-gray-500",
                  "dark:bg-gray-800 dark:text-gray-400"
                )}
              >
                대기 중
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
