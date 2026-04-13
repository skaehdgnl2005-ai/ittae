"use client";
import { VoteCell } from "./VoteCell";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { getBestDate, getVoteSummary } from "@/lib/vote";
import type { Vote, VoteSession, User, VoteChoice } from "@/types";

type VoteMatrixProps = {
  session: VoteSession;
  votes: Vote[];
  members: User[];
  currentUserId: string;
  onVote: (date: string, choice: VoteChoice) => void;
};

function cycleChoice(current: VoteChoice | null): VoteChoice {
  if (!current || current === "unavailable") return "available";
  if (current === "available") return "maybe";
  return "unavailable";
}

export function VoteMatrix({ session, votes, members, currentUserId, onVote }: VoteMatrixProps) {
  const bestDate = getBestDate(session, votes);
  const summary = getVoteSummary(session, votes);

  const getVote = (userId: string, date: string): VoteChoice | null =>
    votes.find((v) => v.userId === userId && v.date === date)?.choice ?? null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className="w-10" />
            {session.candidateDates.map((date) => (
              <th
                key={date}
                scope="col"
                className={cn(
                  "text-center p-2 text-xs font-medium text-gray-500",
                  bestDate === date && "bg-violet-50 dark:bg-violet-900/20"
                )}
              >
                {date.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td className="py-1 pr-2 w-10">
                <Avatar nickname={member.nickname} size="sm" />
              </td>
              {session.candidateDates.map((date) => {
                const choice = getVote(member.id, date);
                const isCurrentUser = member.id === currentUserId;
                return (
                  <td
                    key={date}
                    className={cn(bestDate === date && "bg-violet-50 dark:bg-violet-900/20")}
                  >
                    <VoteCell
                      choice={choice}
                      isCurrentUser={isCurrentUser}
                      onClick={isCurrentUser ? () => onVote(date, cycleChoice(choice)) : undefined}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 집계 행 */}
      <div className="flex mt-2 px-2 gap-1">
        <div className="w-10" />
        {session.candidateDates.map((date) => (
          <div
            key={date}
            className={cn(
              "flex-1 text-center text-xs text-gray-500",
              bestDate === date && "text-violet-600 font-semibold"
            )}
          >
            {summary[date]?.available ?? 0}명
          </div>
        ))}
      </div>
    </div>
  );
}
