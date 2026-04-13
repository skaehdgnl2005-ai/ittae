"use client";
import { cn } from "@/lib/utils";
import type { GroupStatus } from "@/types";

type FilterValue = "all" | GroupStatus;

type FilterChipProps = {
  value: FilterValue;
  label: string;
  selected: boolean;
  onSelect: (value: FilterValue) => void;
};

export function FilterChip({ value, label, selected, onSelect }: FilterChipProps) {
  return (
    <button
      onClick={() => onSelect(value)}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0",
        selected
          ? "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      )}
    >
      {label}
    </button>
  );
}
