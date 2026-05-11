"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AddPersonalScheduleSheet } from "./AddPersonalScheduleSheet";
import { useRequireAuth } from "@/lib/auth-gate";

type Props = {
  defaultDate?: Date;
  isAuthed: boolean;
};

export function AddPersonalScheduleButton({ defaultDate, isAuthed }: Props) {
  const [open, setOpen] = useState(false);
  const requireAuth = useRequireAuth(isAuthed);

  return (
    <>
      <button
        type="button"
        aria-label="내 일정 추가"
        onClick={() => requireAuth(() => setOpen(true))}
        className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all min-h-11 min-w-11 text-gray-700 dark:text-gray-300"
      >
        <Plus size={20} strokeWidth={2} />
      </button>
      {isAuthed && (
        <AddPersonalScheduleSheet
          open={open}
          onClose={() => setOpen(false)}
          defaultDate={defaultDate ?? new Date()}
        />
      )}
    </>
  );
}
