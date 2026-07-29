"use client";

import { useTransition } from "react";
import { deleteAsset } from "@/app/assets/actions";
import { Button } from "@/components/ui/Button";

export function DeleteAssetButton({
  assetId,
  label,
}: {
  assetId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className="border-destructive text-destructive hover:bg-destructive/10"
      onClick={() => {
        if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
        startTransition(async () => {
          try {
            await deleteAsset(assetId);
          } catch (err) {
            if (
              err &&
              typeof err === "object" &&
              "digest" in err &&
              String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
            ) {
              throw err;
            }
            window.alert(err instanceof Error ? err.message : "Failed to delete asset.");
          }
        });
      }}
    >
      {pending ? "Deleting..." : "Delete"}
    </Button>
  );
}
