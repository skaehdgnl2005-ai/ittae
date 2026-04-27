// src/components/friends/AddFriendSheet.tsx
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, Copy, Share2 } from "lucide-react";
import { searchUsersByNickname } from "@/app/friends/actions";
import { shareInviteLink } from "@/lib/share";
import { ROUTES } from "@/lib/routes";
import { UserSearchResultCard } from "@/components/friends/UserSearchResultCard";
import { cn } from "@/lib/utils";
import type { UserSearchResult } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  myInviteCode: string;
  myNickname: string;
};

const DEBOUNCE_MS = 300;

export function AddFriendSheet({ open, onClose, myInviteCode, myNickname }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [shareToast, setShareToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 디바운스 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await searchUsersByNickname(query);
        if (r.ok) setResults(r.data);
        else setResults([]);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  // 시트 닫히면 리셋
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setShareToast(null);
    }
  }, [open]);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${ROUTES.INVITE(myInviteCode)}`
      : ROUTES.INVITE(myInviteCode);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareToast("초대 링크를 복사했어요");
    } catch {
      setShareToast("복사에 실패했어요");
    }
  }

  async function handleShare() {
    const r = await shareInviteLink({ url: inviteUrl, hostNickname: myNickname });
    setShareToast(
      r === "kakao" ? "카카오톡 공유 창을 열었어요"
        : r === "clipboard" ? "초대 링크를 복사했어요"
        : "공유에 실패했어요"
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 dark:bg-black/60">
      <div
        role="dialog"
        aria-label="친구 추가"
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-2xl p-5 pb-8 max-h-[80dvh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">친구 추가</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="min-h-11 min-w-11 -mr-2 text-gray-400"
          >
            ×
          </button>
        </div>

        {/* 내 초대 링크 */}
        <section className="mb-6">
          <p className="text-[12px] font-medium text-gray-500 mb-2">내 초대 링크</p>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2.5">
            <code className="flex-1 text-sm text-gray-800 dark:text-gray-100 truncate">
              {inviteUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="초대 링크 복사"
              className="min-h-11 min-w-11 flex items-center justify-center text-gray-500"
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="카카오톡으로 공유"
              className="min-h-11 min-w-11 flex items-center justify-center text-violet-600"
            >
              <Share2 size={16} />
            </button>
          </div>
          {shareToast && (
            <p className="text-xs text-violet-600 mt-1.5">{shareToast}</p>
          )}
        </section>

        {/* 닉네임 검색 */}
        <section>
          <p className="text-[12px] font-medium text-gray-500 mb-2">닉네임으로 찾기</p>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="닉네임 검색"
              placeholder="닉네임 일부를 입력"
              className={cn(
                "w-full pl-9 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm",
                "outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white transition-all",
                "dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900"
              )}
            />
          </div>

          <div className="mt-3 space-y-1">
            {isPending && query && (
              <p className="text-xs text-gray-400 py-2 text-center">검색 중...</p>
            )}
            {!isPending && query && results.length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center">검색 결과 없음</p>
            )}
            {results.map((u) => (
              <UserSearchResultCard key={u.id} user={u} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
