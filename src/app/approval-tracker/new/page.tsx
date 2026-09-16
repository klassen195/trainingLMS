import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { listApprovalProfiles } from "@/app/approval-tracker/actions";
import { ApprovalDocumentForm } from "@/components/ApprovalDocumentForm";
import { Button } from "@/components/ui/Button";

export default async function NewApprovalDocumentPage() {
  const profile = await requireCapability("approval_tracker");
  const profiles = await listApprovalProfiles();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ListChecks className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">New Policy</h1>
        </div>
        <p className="text-muted-foreground">
          Mark it as new or a replacement, assign the person responsible, and send it down the
          approval path. You can attach a file now or later.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/approval-tracker">Back to board</Link>
          </Button>
        </div>
      </div>

      <ApprovalDocumentForm profiles={profiles} defaultAssignedTo={profile.id} />
    </div>
  );
}
