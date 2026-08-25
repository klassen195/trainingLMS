import { getAuthContext } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import { listClients } from "@/app/admin/clients/actions";
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
  const mustChangePassword = ctx.kind === "authenticated" && ctx.mustChangePassword;
  const isPlatformAdmin = ctx.kind === "authenticated" && ctx.isPlatformAdmin;
  const capabilities =
    profile && !mustChangePassword ? await getProfileCapabilities(profile) : null;
  const actingClients = isPlatformAdmin && !mustChangePassword ? await listClients() : [];

  return (
    <header className="sticky top-0 z-[100] w-full overflow-visible bg-background shadow-sm">
      <MainNav
        profile={profile}
        mustChangePassword={mustChangePassword}
        actingClientId={ctx.kind === "authenticated" ? ctx.clientId : null}
        actingClients={actingClients}
        showInstructor={Boolean(capabilities?.author_training)}
        showShiftExchange={Boolean(capabilities?.access_shift_exchange)}
        showPrograms={Boolean(capabilities?.access_programs)}
        showAssets={Boolean(capabilities?.access_assets)}
        showIncidents={Boolean(capabilities?.manage_incidents)}
        showFleet={Boolean(capabilities?.view_fleet)}
        showPersonnel={Boolean(capabilities?.access_personnel)}
        showDocumentTraining={Boolean(capabilities?.document_training)}
        showApprovals={Boolean(capabilities?.approval_tracker)}
        showAdmin={Boolean(
          profile?.is_admin ||
            capabilities?.manage_users ||
            capabilities?.manage_locations ||
            capabilities?.manage_vehicle_check_templates ||
            capabilities?.manage_quiz_banks ||
            capabilities?.manage_assets
        )}
      />
      <BreadcrumbNav />
    </header>
  );
}
