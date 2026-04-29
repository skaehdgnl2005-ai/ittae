"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MemberSelector } from "@/components/create/MemberSelector";
import { CandidateDatePicker } from "@/components/create/CandidateDatePicker";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type CreateMeetingFormProps = {
  friends: User[];
};

export function CreateMeetingForm({ friends }: CreateMeetingFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [candidateDates, setCandidateDates] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    name.trim().length > 0 && candidateDates.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    try {
      // 1. 그룹 생성
      const groupRes = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), memberIds }),
      });

      if (!groupRes.ok) {
        setError("모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      const { data: group }: { data: { id: string } } =
        await groupRes.json();

      // 2. 투표 세션 생성
      const sessionRes = await fetch("/api/vote-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.id,
          candidateDates,
          deadline: deadline || null,
        }),
      });

      if (!sessionRes.ok) {
        // 투표 세션 생성 실패 시에도 그룹 페이지로 이동
        router.push(`/group/${group.id}?welcome=1`);
        return;
      }

      router.push(`/group/${group.id}?welcome=1`);
    } catch {
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-5 py-6 space-y-5"
    >
      {/* 모임 이름 */}
      <div>
        <label
          htmlFor="meeting-name"
          className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
        >
          모임 이름 <span className="text-violet-600">*</span>
        </label>
        <input
          id="meeting-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 여름 치맥 번개"
          maxLength={30}
          className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white dark:focus:bg-gray-700 transition-all"
        />
      </div>

      {/* 참여자 선택 */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          참여자 선택{" "}
          <span className="text-xs font-normal text-gray-400">
            (본인 자동 포함)
          </span>
        </p>
        <MemberSelector
          friends={friends}
          selected={memberIds}
          onChange={setMemberIds}
        />
      </div>

      {/* 후보 날짜 */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          후보 날짜 <span className="text-violet-600">*</span>{" "}
          <span className="text-xs font-normal text-gray-400">
            여러 날 선택 가능
          </span>
        </p>
        <CandidateDatePicker
          selected={candidateDates}
          onChange={setCandidateDates}
        />
      </div>

      {/* 투표 마감일 (선택) */}
      <div>
        <label
          htmlFor="deadline"
          className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
        >
          투표 마감일{" "}
          <span className="text-xs font-normal text-gray-400">선택</span>
        </label>
        <input
          id="deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white dark:focus:bg-gray-700 transition-all"
        />
      </div>

      {/* 에러 */}
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* CTA */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          "w-full h-[52px] rounded-xl text-base font-semibold text-white transition-all active:scale-[0.97]",
          canSubmit
            ? "bg-violet-600 hover:bg-violet-700"
            : "bg-violet-600 opacity-40 cursor-not-allowed"
        )}
      >
        {submitting ? "만드는 중..." : "모임 만들고 투표 시작"}
      </button>
    </motion.div>
  );
}
