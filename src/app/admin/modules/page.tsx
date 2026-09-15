import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getCurrentClientModules } from "@/app/admin/modules/actions";
import { ClientModulesEditor } from "@/components/ClientModulesEditor";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function AdminModulesPage() {
  await requireAdmin();
  const { clientId, modules } = await getCurrentClientModules();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link href="/admin">Back to Admin</Link>
        </Button>
        <div className="mb-2 flex items-center gap-3">
          <LayoutGrid className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Module order</h1>
        </div>
        <p className="text-muted-foreground">
          Drag to set this department&apos;s main navigation order. Module on/off is controlled by the
          platform.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Navigation modules</CardTitle>
          <CardDescription>
            Off modules stay in the list so you can place them before they are turned on. They will not
            appear in the nav while off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientModulesEditor
            clientId={clientId}
            modules={modules}
            allowToggle={false}
            title="Department order"
            description="Drag to reorder. Use master order to match the platform default."
          />
        </CardContent>
      </Card>
    </div>
  );
}
