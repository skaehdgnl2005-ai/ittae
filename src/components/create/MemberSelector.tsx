"use client";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type MemberSelectorProps = {
  friends: User[];
  selected: string[];
  onChange: (ids: string[]) => void;
};

export function MemberSelector({
  friends,
  selected,
  onChange,
}: MemberSelectorProps) {
  const toggle = (userId: string) => {
    if (selected.includes(userId)) {
      onChange(selected.filter((id) => id !== userId));
    } else {
      onChange([...selected, userId]);
    }
  };

  if (friends.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
        아직 친구가 없어요.{" "}
        <span className="text-violet-600 dark:text-violet-400">친구 탭</span>
        에서 먼저 추가해보세요.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 선택된 친구 칩 */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const user = friends.find((f) => f.id === id);
            if (!user) return null;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                aria-label={`${user.nickname} 선택 해제`}
                className="flex items-center gap-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-full pl-1 pr-3 py-1"
              >
                <Avatar user={user} size="sm" />
                <span className="text-xs font-medium text-violet-800 dark:text-violet-300">
                  {user.nickname}
                </span>
                <span
                  aria-hidden
                  className="text-violet-500 text-xs ml-0.5"
                >
                  ×
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 아바타 가로 스크롤 */}
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        {friends.map((user) => {
          const isSelected = selected.includes(user.id);
          return (
            <button
              key={user.id}
              onClick={() => toggle(user.id)}
              aria-label={`${user.nickname} ${isSelected ? "선택 해제" : "선택"}`}
              aria-pressed={isSelected}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[52px]"
            >
              <div
                className={cn(
                  "transition-all",
                  isSelected &&
                    "ring-2 ring-violet-600 ring-offset-2 rounded-full"
                )}
              >
                <Avatar user={user} size="md" />
              </div>
              <span
                className={cn(
                  "text-xs truncate max-w-[52px]",
                  isSelected
                    ? "text-violet-600 dark:text-violet-400 font-medium"
                    : "text-gray-600 dark:text-gray-400"
                )}
              >
                {user.nickname}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 인라인 아바타 헬퍼 ──────────────────────────────────────────
type AvatarSize = "sm" | "md";

const AVATAR_SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "w-[22px] h-[22px] text-[9px]",
  md: "w-11 h-11 text-base",
};

function Avatar({ user, size }: { user: User; size: AvatarSize }) {
  const initials = user.nickname.slice(0, 1);
  const colors = [
    "bg-violet-500",
    "bg-violet-400",
    "bg-violet-300 text-violet-800",
    "bg-gray-400",
    "bg-gray-300 text-gray-700",
  ];
  const colorClass = colors[user.id.charCodeAt(0) % colors.length];
  const sizeClass = AVATAR_SIZE_CLASS[size];

  if (user.profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.profileImageUrl}
        alt={user.nickname}
        className={cn("rounded-full object-cover", sizeClass)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold",
        sizeClass,
        colorClass
      )}
    >
      {initials}
    </div>
  );
}
