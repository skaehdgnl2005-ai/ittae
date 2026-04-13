"use client";
import { cn } from "@/lib/utils";

type Category = "FD6" | "CE7" | "SW8";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "FD6", label: "음식점" },
  { value: "CE7", label: "카페" },
  { value: "SW8", label: "지하철" },
];

type CategoryFilterBarProps = {
  selected: Category | null;
  onSelect: (c: Category | null) => void;
};

export function CategoryFilterBar({ selected, onSelect }: CategoryFilterBarProps) {
  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
      {CATEGORIES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onSelect(selected === value ? null : value)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-colors",
            selected === value
              ? "bg-violet-600 text-white"
              : "bg-white text-gray-700 border border-gray-200"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
