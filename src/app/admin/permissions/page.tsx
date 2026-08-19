import { Shield } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadCapabilityMatrix } from "@/lib/capability-access";
import { Button } from "@/components/ui/Button";
import { PermissionMatrixEditor } from "./ui";

export default async function AdminPermissionsPage() {
  await requireAdmin();
  const { levels, matrix } = await loadCapabilityMatrix();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link href="/admin">Back to Admin</Link>
        </Button>
        <div className="mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Permission capabilities</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Create named permission levels for this department, then choose what each level can access.
          System admins always have every capability.
        </p>
      </div>

      <PermissionMatrixEditor levels={levels} initialMatrix={matrix} />
    </div>
  );
}
