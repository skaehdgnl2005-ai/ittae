// src/components/friends/GroupCard.tsx
import { AvatarGroup } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Group } from "@/types";

type GroupCardProps = {
  group: Group;
  onClick?: () => void;
};

export function GroupCard({ group, onClick }: GroupCardProps) {
  return (
    <Card onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate dark:text-gray-100">{group.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
            {group.members.length}명
            {group.confirmedDate && ` · ${group.confirmedDate}`}
          </p>
        </div>
        <Badge status={group.status} />
      </div>
      <div className="mt-3">
        <AvatarGroup users={group.members} max={4} />
      </div>
    </Card>
  );
}
