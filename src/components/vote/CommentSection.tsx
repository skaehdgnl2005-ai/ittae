import { Avatar } from "@/components/ui/Avatar";
import type { Vote, User } from "@/types";

type CommentSectionProps = {
  votes: Vote[];
  members: User[];
};

export function CommentSection({ votes, members }: CommentSectionProps) {
  const comments = votes.filter((v) => v.comment);
  if (comments.length === 0) return null;

  return (
    <div className="px-5 mt-4">
      <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400">코멘트</h3>
      <div className="space-y-3">
        {comments.map((vote) => {
          const user = members.find((m) => m.id === vote.userId);
          if (!user) return null;
          return (
            <div key={vote.id} className="flex items-start gap-2">
              <Avatar nickname={user.nickname} size="sm" />
              <div className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{user.nickname}</p>
                <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{vote.comment}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
