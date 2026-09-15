import { Building2 } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth";
import { getPlatformModuleOrder, listClientsWithModules } from "@/app/admin/clients/actions";
import { ClientsAdminUi } from "@/app/admin/clients/ui";

export default async function ClientsAdminPage() {
  await requirePlatformAdmin();
  const [clients, masterOrder] = await Promise.all([
    listClientsWithModules(),
    getPlatformModuleOrder(),
  ]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Clients</h1>
        </div>
        <p className="text-muted-foreground">
          Platform-only: set the master module order, create Client ID codes, and choose modules per
          client.
        </p>
      </div>
      <ClientsAdminUi clients={clients} masterOrder={masterOrder} />
    </div>
  );
}
