import { cn } from "@/lib/utils";
import type { GroupStatus } from "@/types";

type BadgeProps = {
  status: GroupStatus;
  className?: string;
};

const statusConfig: Record<GroupStatus, { label: string; className: string }> = {
  voting: { label: "투표 중", className: "bg-amber-50 text-amber-600" },
  confirmed: { label: "확정", className: "bg-emerald-50 text-emerald-600" },
  completed: { label: "완료", className: "bg-gray-100 text-gray-500" },
};

export function Badge({ status, className }: BadgeProps) {
  const { label, className: statusClass } = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-[6px] text-xs font-medium",
        statusClass,
        className
      )}
    >
      {label}
    </span>
  );
}
