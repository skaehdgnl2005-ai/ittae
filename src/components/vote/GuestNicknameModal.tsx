"use client";

import { useState } from "react";

type Props = {
  groupName: string;
  onSubmit: (nickname: string) => void;
};

export function GuestNicknameModal({ groupName, onSubmit }: Props) {
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const trimmed = nickname.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 12;

  const handleSubmit = () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 dark:bg-gray-900 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {groupName}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          모임에 참여하려면 닉네임을 입력해주세요.
        </p>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="예: 민지"
          maxLength={12}
          className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          autoFocus
        />
        <button
          type="button"
          disabled={!valid || submitting}
          onClick={handleSubmit}
          className="mt-4 w-full min-h-11 rounded-xl bg-violet-600 py-3 font-semibold text-white transition-colors hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-700"
          aria-label="닉네임으로 참여"
        >
          {submitting ? "참여 중…" : "투표 참여하기"}
        </button>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          이 폰에서만 본인 투표를 수정할 수 있어요.
        </p>
      </div>
    </div>
  );
}
