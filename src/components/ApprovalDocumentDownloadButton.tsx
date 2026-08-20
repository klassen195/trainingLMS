"use client";

import { useState, useTransition } from "react";
import { getApprovalDocumentDownloadUrl } from "@/app/approval-tracker/actions";
import { Button } from "@/components/ui/Button";

export function ApprovalDocumentDownloadButton({
  documentId,
  fileName,
}: {
  documentId: string;
  fileName: string;
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
              const { url } = await getApprovalDocumentDownloadUrl({ documentId });
              window.open(url, "_blank", "noopener,noreferrer");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Download failed.");
            }
          });
        }}
      >
        {pending ? "Opening…" : fileName}
      </Button>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
