import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { ApprovalDocumentForm } from "@/components/ApprovalDocumentForm";
import { Button } from "@/components/ui/Button";

export default async function NewApprovalDocumentPage() {
  await requireCapability("approval_tracker");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ListChecks className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">New document</h1>
        </div>
        <p className="text-muted-foreground">
          Mark it as new or a replacement, upload the file, and send it down the approval path.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/approval-tracker">Back to board</Link>
          </Button>
        </div>
      </div>

      <ApprovalDocumentForm />
    </div>
  );
}
