"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { ROUTES } from "@/lib/routes";

export function useRequireAuth(isAuthed: boolean) {
  const router = useRouter();
  return useCallback(
    (action?: () => void) => {
      if (isAuthed) {
        action?.();
        return true;
      }
      toast.error("로그인이 필요한 기능입니다");
      router.push(ROUTES.LOGIN);
      return false;
    },
    [isAuthed, router]
  );
}
