import { ClipboardPen } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";

export default async function DocumentTrainingPage() {
  await requireUserProfile();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ClipboardPen className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Document Training</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Record and track completed training sessions.
        </p>
      </div>

      <div className="rounded-lg border py-12 text-center">
        <ClipboardPen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Coming soon. This module is a placeholder.</p>
      </div>
    </div>
  );
}
