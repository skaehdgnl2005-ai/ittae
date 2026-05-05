"use client";

import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

export function WelcomeVoteBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const visible = !dismissed && searchParams.get("welcome") === "1";

  const handleClose = () => {
    setDismissed(true);
    router.replace(pathname);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mx-5 mt-3 flex items-start gap-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 px-4 py-3"
        >
          <Sparkles
            size={18}
            className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-400"
            strokeWidth={2}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
              모임이 만들어졌어요!
            </p>
            <p className="mt-0.5 text-xs text-violet-700 dark:text-violet-300">
              가능한 시간을 선택한 뒤 <b>‘내 투표 저장하기’</b>를 눌러주세요.
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="안내 닫기"
            className="-mr-1 -mt-1 min-h-9 min-w-9 flex items-center justify-center rounded-lg text-violet-600 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
