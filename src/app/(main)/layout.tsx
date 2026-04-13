import { BottomTabNav } from "@/components/layout/BottomTabNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="pb-[83px] min-h-dvh dark:bg-gray-900">{children}</main>
      <BottomTabNav />
    </>
  );
}
