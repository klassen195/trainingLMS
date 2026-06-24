import type { Profile } from "@/lib/training-lms-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MainNav } from "@/components/MainNav";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";

export async function AppHeader() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    profile = (data as Profile | null) ?? null;
  }

  return (
    <header className="sticky top-0 z-[100] w-full overflow-visible bg-background shadow-sm">
      <MainNav profile={profile} />
      <BreadcrumbNav />
    </header>
  );
}
