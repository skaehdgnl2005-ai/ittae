"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, PlusCircle, Map, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home",    label: "홈",    icon: Home },
  { href: "/friends", label: "친구",  icon: Users },
  { href: "/create",  label: "모임",  icon: PlusCircle },
  { href: "/map",     label: "지도",  icon: Map },
  { href: "/history", label: "기록",  icon: Clock },
] as const;

export function BottomTabNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-[83px] bg-white border-t border-gray-200 flex items-start pt-2 z-50">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className="flex-1 flex flex-col items-center gap-1 min-h-11 justify-center"
          >
            <Icon
              size={20}
              className={cn(active ? "text-violet-600" : "text-gray-400")}
              strokeWidth={1.5}
            />
            <span
              className={cn(
                "text-[10px] font-medium",
                active ? "text-violet-600" : "text-gray-400"
              )}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
