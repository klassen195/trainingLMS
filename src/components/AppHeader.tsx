import { getAuthContext } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import { MainNav } from "@/components/MainNav";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";

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
