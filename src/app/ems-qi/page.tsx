import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { EmsQiReviewForm } from "@/components/EmsQiReviewForm";

export default async function EmsQiPage() {
  await requireRole(["instructor", "admin"]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">EMS Call QA/QI</h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Review an EMS call, score checklist items, copy the summary into your charting or QA program, then clear the
          form for the next review. Nothing is saved.
        </p>
      </div>

      <EmsQiReviewForm />
    </div>
  );
}
