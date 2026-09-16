import { getAuthContext } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import { loadClientModules } from "@/lib/client-modules-server";
import { CLIENT_MODULES, type ClientModuleKey } from "@/lib/client-modules";
import { getClientLogoSignedUrl } from "@/lib/client-logo";
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
  const clientModules =
    ctx.kind === "authenticated" && !mustChangePassword
      ? await loadClientModules(ctx.clientId)
      : [];
  const departmentLogoUrl =
    ctx.kind === "authenticated" ? await getClientLogoSignedUrl(ctx.clientId) : null;

  const moduleOrder = (
    clientModules.length > 0 ? clientModules.map((row) => row.module_key) : [...CLIENT_MODULES]
  ) as ClientModuleKey[];

  const enabledModules = Object.fromEntries(
    CLIENT_MODULES.map((key) => [key, Boolean(capabilities?.[key])])
  ) as Partial<Record<ClientModuleKey, boolean>>;

  return (
    <header className="sticky top-0 z-[100] w-full overflow-visible bg-background shadow-sm">
      <MainNav
        profile={profile}
        mustChangePassword={mustChangePassword}
        actingClientId={ctx.kind === "authenticated" ? ctx.clientId : null}
        actingClients={actingClients}
        departmentLogoUrl={departmentLogoUrl}
        moduleOrder={moduleOrder}
        enabledModules={enabledModules}
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
