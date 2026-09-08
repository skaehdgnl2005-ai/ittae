"use client";

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getAvailableParticipantsForSlot } from "@/lib/vote";
import type { TimeSlot, User, Guest } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: { date: string; time: string } | null;
  timeSlots: TimeSlot[];
  members: User[];
  guests: Guest[];
};

function endTimeOfSlot(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return m === 30 ? `${h + 1}:00` : `${h}:30`;
}

function initials(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return "?";
  return Array.from(trimmed)[0] ?? "?";
}

export function SlotPeekSheet({
  open,
  onOpenChange,
  slot,
  timeSlots,
  members,
  guests,
}: Props) {
  const { availableMembers, availableGuests, total } = useMemo(() => {
    if (!slot) {
      return { availableMembers: [] as User[], availableGuests: [] as Guest[], total: 0 };
    }
    const { memberIds, guestIds } = getAvailableParticipantsForSlot(
      timeSlots,
      slot.date,
      slot.time
    );
    const memberSet = new Set(memberIds);
    const guestSet = new Set(guestIds);
    const m = members.filter((u) => memberSet.has(u.id));
    const g = guests.filter((u) => guestSet.has(u.id));
    return { availableMembers: m, availableGuests: g, total: m.length + g.length };
  }, [slot, timeSlots, members, guests]);

  const totalParticipants = members.length + guests.length;
  const rangeLabel = slot ? `${slot.time} ~ ${endTimeOfSlot(slot.time)}` : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[80dvh] overflow-y-auto p-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-gray-100 dark:border-gray-700">
          <SheetTitle className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {rangeLabel}
          </SheetTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {total}/{totalParticipants}명 가능
          </p>
        </SheetHeader>
        <div className="p-4">
          {total === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              아직 아무도 이 시간을 고르지 않았어요
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {availableMembers.map((u) => (
                <li
                  key={`m-${u.id}`}
                  className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2"
                >
                  {u.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.profileImageUrl}
                      alt={u.nickname}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-sm font-medium flex items-center justify-center">
                      {initials(u.nickname)}
                    </div>
                  )}
                  <span className="text-sm text-gray-800 dark:text-gray-100 truncate">
                    {u.nickname}
                  </span>
                </li>
              ))}
              {availableGuests.map((g) => (
                <li
                  key={`g-${g.id}`}
                  className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium flex items-center justify-center">
                    {initials(g.nickname)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-100 truncate">
                      {g.nickname}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      게스트
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
