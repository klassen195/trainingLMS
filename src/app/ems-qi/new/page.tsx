import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { EmsQiReviewForm } from "@/components/EmsQiReviewForm";
import { Button } from "@/components/ui/Button";

export default async function NewEmsQiReviewPage() {
  await requireRole(["instructor", "admin"]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4 px-0 hover:bg-transparent">
          <Link href="/ems-qi">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to reviews
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">New EMS Call Review</h1>
        <p className="mt-2 text-muted-foreground">
          Fill in the review fields. The export summary updates as you go.
        </p>
      </div>

      <EmsQiReviewForm />
    </div>
  );
}
