import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

type AvatarProps = {
  nickname: string;
  profileImageUrl?: string | null;
  size?: Size;
  className?: string;
};

const sizeMap: Record<Size, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-16 h-16 text-lg",
};

export function Avatar({ nickname, profileImageUrl, size = "sm", className }: AvatarProps) {
  const initial = nickname.charAt(0);
  return (
    <div
      className={cn(
        "rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-medium border-2 border-white shrink-0",
        sizeMap[size],
        className
      )}
    >
      {profileImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profileImageUrl} alt={nickname} className="w-full h-full rounded-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

type AvatarGroupProps = {
  users: Array<{ id: string; nickname: string; profileImageUrl?: string | null }>;
  max?: number;
};

export function AvatarGroup({ users, max = 4 }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const rest = users.length - max;
  return (
    <div className="flex items-center">
      {visible.map((user, i) => (
        <Avatar
          key={user.id}
          nickname={user.nickname}
          profileImageUrl={user.profileImageUrl}
          size="sm"
          className={i > 0 ? "-ml-2" : ""}
        />
      ))}
      {rest > 0 && (
        <div className="-ml-2 w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs text-gray-500 shrink-0">
          +{rest}
        </div>
      )}
    </div>
  );
}
