"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Users, CalendarCheck, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/lib/auth-gate";

const tabs = [
  { href: "/home",    label: "홈",    icon: Home,          protected: false },
  { href: "/friends", label: "친구",  icon: Users,         protected: true  },
  { href: "/create",  label: "모임",  icon: CalendarCheck, protected: true  },
  { href: "/map",     label: "지도",  icon: Map,           protected: true  },
] as const;

type Props = {
  isAuthed: boolean;
};

export function BottomTabNav({ isAuthed }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const requireAuth = useRequireAuth(isAuthed);

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-[83px] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-start pt-2 z-50">
      {tabs.map(({ href, label, icon: Icon, protected: isProtected }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        const iconClass = cn(
          active
            ? "text-violet-600 dark:text-violet-400"
            : "text-gray-400 dark:text-gray-500"
        );
        const labelClass = cn(
          "text-[10px] font-medium",
          active
            ? "text-violet-600 dark:text-violet-400"
            : "text-gray-400 dark:text-gray-500"
        );
        const wrapperClass =
          "flex-1 flex flex-col items-center gap-1 min-h-11 justify-center";

        if (isProtected && !isAuthed) {
          return (
            <button
              key={href}
              type="button"
              aria-label={label}
              onClick={() => requireAuth(() => router.push(href))}
              className={wrapperClass}
            >
              <Icon size={20} className={iconClass} strokeWidth={1.5} />
              <span className={labelClass}>{label}</span>
            </button>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={wrapperClass}
          >
            <Icon size={20} className={iconClass} strokeWidth={1.5} />
            <span className={labelClass}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
