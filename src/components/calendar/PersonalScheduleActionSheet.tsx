"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/Button";
import type { Schedule } from "@/types";

type Props = {
  open: boolean;
  schedule: Schedule | null;
  onClose: () => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
};

export function PersonalScheduleActionSheet({
  open,
  schedule,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-gray-100 dark:border-gray-700">
          <SheetTitle className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {schedule?.title ?? "일정"}
          </SheetTitle>
        </SheetHeader>
        <div className="p-4 flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => schedule && onEdit(schedule)}
          >
            편집
          </Button>
          <Button
            variant="danger"
            onClick={() => schedule && onDelete(schedule)}
          >
            삭제
          </Button>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
