"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/Button";
import { PersonalScheduleFormFields } from "@/components/calendar/PersonalScheduleFormFields";
import {
  createPersonalSchedule,
  updatePersonalSchedule,
  type PersonalScheduleInput,
} from "@/app/(main)/home/schedule-actions";
import type { Schedule } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  defaultDate: Date;
  editingSchedule?: Schedule | null;
};

function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeTimeInput(t: string): string {
  // "14:00:00" or "14:00" → "14:00"
  if (!t) return "";
  const parts = t.split(":");
  return `${parts[0]}:${parts[1] ?? "00"}`;
}

export function AddPersonalScheduleSheet({
  open,
  onClose,
  defaultDate,
  editingSchedule,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateInputValue(defaultDate));
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEditing = !!editingSchedule;

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- form prefill on sheet open is intentional sync */
    if (editingSchedule) {
      const isAll =
        normalizeTimeInput(editingSchedule.startTime) === "00:00" &&
        normalizeTimeInput(editingSchedule.endTime) === "23:59";
      setTitle(editingSchedule.title);
      setDate(editingSchedule.date);
      setIsAllDay(isAll);
      setStartTime(normalizeTimeInput(editingSchedule.startTime) || "09:00");
      setEndTime(normalizeTimeInput(editingSchedule.endTime) || "10:00");
      setMemo(editingSchedule.memo ?? "");
    } else {
      setTitle("");
      setDate(toDateInputValue(defaultDate));
      setIsAllDay(false);
      setStartTime("09:00");
      setEndTime("10:00");
      setMemo("");
    }
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editingSchedule, defaultDate]);

  function handleSubmit() {
    const input: PersonalScheduleInput = {
      title,
      date,
      startTime,
      endTime,
      memo: memo.trim() || null,
      isAllDay,
    };
    setError(null);
    startTransition(async () => {
      const result = editingSchedule
        ? await updatePersonalSchedule(editingSchedule.id, input)
        : await createPersonalSchedule(input);
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90dvh] overflow-y-auto p-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-gray-100 dark:border-gray-700">
          <SheetTitle className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {isEditing ? "내 일정 수정" : "내 일정 추가"}
          </SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-4">
          <PersonalScheduleFormFields
            title={title}
            onTitleChange={setTitle}
            date={date}
            onDateChange={setDate}
            isAllDay={isAllDay}
            onAllDayChange={setIsAllDay}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            endTime={endTime}
            onEndTimeChange={setEndTime}
            memo={memo}
            onMemoChange={setMemo}
            error={error}
          />

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={isPending || !title.trim()}
            >
              {isPending ? "저장 중..." : isEditing ? "수정" : "저장"}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              취소
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
