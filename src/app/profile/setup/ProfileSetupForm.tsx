"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { setupProfile } from "./actions";

type Props = {
  userId: string;
  email: string;
  defaultNickname: string;
  defaultAvatarUrl: string | null;
};

export function ProfileSetupForm({
  userId,
  email,
  defaultNickname,
  defaultAvatarUrl,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [nickname, setNickname] = useState(defaultNickname.slice(0, 20));
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isValid = nickname.trim().length >= 1;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isPending) return;

    setError(null);
    startTransition(async () => {
      try {
        await setupProfile({
          userId,
          email,
          nickname: nickname.trim(),
          profileImageUrl: defaultAvatarUrl,
          statusMessage: statusMessage.trim() || null,
        });
        router.push("/home");
        router.refresh();
      } catch {
        setError("프로필 저장에 실패했습니다. 다시 시도해 주세요.");
      }
    });
  }

  const avatarLetter = nickname.trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-dvh flex flex-col px-6 py-12">
      {/* 헤더 */}
      <div className="mb-10">
        <h1 className="text-[22px] font-semibold text-gray-900 dark:text-gray-50 mb-1">
          프로필 설정
        </h1>
        <p className="text-[14px] text-gray-500 dark:text-gray-400">
          이때에서 사용할 나를 소개해 주세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-8">
        {/* 프로필 이미지 미리보기 */}
        <div className="flex justify-center">
          {defaultAvatarUrl ? (
            <Image
              src={defaultAvatarUrl}
              alt="프로필 이미지"
              width={80}
              height={80}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
              <span className="text-2xl font-semibold text-violet-600 dark:text-violet-300">
                {avatarLetter}
              </span>
            </div>
          )}
        </div>

        {/* 닉네임 */}
        <div className="space-y-2">
          <label
            htmlFor="nickname"
            className="block text-[13px] font-medium text-gray-700 dark:text-gray-300"
          >
            닉네임
            <span className="text-violet-600 ml-0.5">*</span>
          </label>
          <div className="relative">
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="최대 20자"
              maxLength={20}
              autoComplete="nickname"
              className={cn(
                "w-full h-12 px-4 rounded-xl border text-[15px] text-gray-900 dark:text-gray-50",
                "bg-white dark:bg-gray-800",
                "placeholder:text-gray-400 dark:placeholder:text-gray-600",
                "outline-none transition-colors",
                "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20",
                nickname.trim().length === 0
                  ? "border-gray-200 dark:border-gray-700"
                  : "border-gray-200 dark:border-gray-700"
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 tabular-nums">
              {nickname.length}/20
            </span>
          </div>
        </div>

        {/* 상태 메시지 */}
        <div className="space-y-2">
          <label
            htmlFor="statusMessage"
            className="block text-[13px] font-medium text-gray-700 dark:text-gray-300"
          >
            상태 메시지
            <span className="ml-1.5 text-[12px] text-gray-400 font-normal">선택</span>
          </label>
          <div className="relative">
            <input
              id="statusMessage"
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value.slice(0, 50))}
              placeholder="지금 나를 한 줄로 표현한다면?"
              maxLength={50}
              className={cn(
                "w-full h-12 px-4 rounded-xl border text-[15px] text-gray-900 dark:text-gray-50",
                "bg-white dark:bg-gray-800",
                "placeholder:text-gray-400 dark:placeholder:text-gray-600 border-gray-200 dark:border-gray-700",
                "outline-none transition-colors",
                "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 tabular-nums">
              {statusMessage.length}/50
            </span>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <p className="text-[13px] text-red-500" role="alert">
            {error}
          </p>
        )}

        {/* 제출 버튼 (하단 고정) */}
        <div className="mt-auto">
          <button
            type="submit"
            disabled={!isValid || isPending}
            className={cn(
              "w-full h-[52px] flex items-center justify-center rounded-xl",
              "text-white text-base font-semibold transition-all duration-150",
              "active:scale-[0.97]",
              isValid && !isPending
                ? "bg-violet-600 active:bg-violet-700"
                : "bg-violet-600/40 pointer-events-none"
            )}
          >
            {isPending ? "저장 중..." : "이때 시작하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
