"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteEmsQiReview } from "@/app/ems-qi/actions";
import { Button } from "@/components/ui/Button";

export function DeleteEmsQiReviewButton({ reviewId }: { reviewId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this EMS QA review? This cannot be undone.")) return;
        startTransition(() => deleteEmsQiReview(reviewId));
      }}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      {pending ? "Deleting..." : "Delete"}
    </Button>
  );
}
