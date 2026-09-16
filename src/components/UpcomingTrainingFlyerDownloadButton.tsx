"use client";

import { useState, useTransition } from "react";
import { getUpcomingTrainingFlyerDownloadUrl } from "@/app/document-training/upcoming/actions";
import { Button } from "@/components/ui/Button";

export function UpcomingTrainingFlyerDownloadButton({
  upcomingTrainingId,
}: {
  upcomingTrainingId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const { url } = await getUpcomingTrainingFlyerDownloadUrl({
                upcomingTrainingId,
              });
              window.open(url, "_blank", "noopener,noreferrer");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Download failed.");
            }
          });
        }}
      >
        {pending ? "Opening…" : "Download"}
      </Button>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
