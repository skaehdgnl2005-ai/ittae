import type { Memory } from "@/types";

type StatsSummaryProps = {
  memories: Memory[];
};

export function StatsSummary({ memories }: StatsSummaryProps) {
  return (
    <div className="px-5 pt-5 pb-4 bg-white border-b border-gray-200">
      <p className="text-xs font-medium text-gray-400 mb-1">지금까지</p>
      <p className="font-serif text-4xl font-medium text-gray-900">
        {memories.length}
        <span className="text-2xl text-gray-600"> 번의 모임</span>
      </p>
    </div>
  );
}
