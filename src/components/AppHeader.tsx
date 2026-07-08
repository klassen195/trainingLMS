import { getAuthContext } from "@/lib/auth";
import { MainNav } from "@/components/MainNav";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";

export async function AppHeader() {
  const ctx = await getAuthContext();
  const profile = ctx.kind === "authenticated" ? ctx.profile : null;

  return (
    <header className="sticky top-0 z-[100] w-full overflow-visible bg-background shadow-sm">
      <MainNav profile={profile} />
      <BreadcrumbNav />
    </header>
  );
}
