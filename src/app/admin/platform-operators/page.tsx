import { Shield } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth";
import { listPlatformOperators } from "@/app/admin/platform-operators/actions";
import { PlatformOperatorsAdminUi } from "@/app/admin/platform-operators/ui";

export default async function PlatformOperatorsAdminPage() {
  await requirePlatformAdmin();
  const operators = await listPlatformOperators();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Platform operators</h1>
        </div>
        <p className="text-muted-foreground">
          A few operators can administer any department without appearing on that department&apos;s
          personnel roster.
        </p>
      </div>
      <PlatformOperatorsAdminUi operators={operators} />
    </div>
  );
}
