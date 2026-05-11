import { BottomTabNav } from "@/components/layout/BottomTabNav";
import { createServerClient } from "@/lib/supabase/server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <>
      <main className="pb-[83px] min-h-dvh dark:bg-gray-900">{children}</main>
      <BottomTabNav isAuthed={!!user} />
    </>
  );
}
