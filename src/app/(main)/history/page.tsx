import { StatsSummary } from "@/components/history/StatsSummary";
import { TimelineView } from "@/components/history/TimelineView";
import { mockMemories, mockPlaces } from "@/lib/mock";

export default function HistoryPage() {
  const sorted = [...mockMemories].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="bg-gray-50 min-h-dvh">
      <StatsSummary memories={mockMemories} />
      <TimelineView memories={sorted} places={mockPlaces} />
    </div>
  );
}

