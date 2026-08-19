import { getAuthContext } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import { MainNav } from "@/components/MainNav";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";

export function AppHeaderFallback() {
  return (
    <header className="sticky top-0 z-[100] w-full overflow-visible bg-background shadow-sm">
      <nav className="relative z-[100] w-full overflow-visible border-b bg-background">
        <div className="container relative mx-auto flex h-20 items-center px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            FD
          </div>
        </div>
      </nav>
    </header>
  );
}

export async function AppHeader() {
  const ctx = await getAuthContext();
  const profile = ctx.kind === "authenticated" ? ctx.profile : null;
  const capabilities = profile ? await getProfileCapabilities(profile) : null;

  return (
    <header className="sticky top-0 z-[100] w-full overflow-visible bg-background shadow-sm">
      <MainNav
        profile={profile}
        showInstructor={Boolean(capabilities?.author_training)}
        showIncidents={Boolean(capabilities?.manage_incidents)}
        showFleet={Boolean(capabilities?.view_fleet)}
        showAdmin={Boolean(
          profile?.is_admin ||
            capabilities?.manage_users ||
            capabilities?.manage_locations ||
            capabilities?.manage_vehicle_check_templates ||
            capabilities?.manage_quiz_banks ||
            capabilities?.resolve_maintenance ||
            capabilities?.manage_assets
        )}
      />
      <BreadcrumbNav />
    </header>
  );
}
