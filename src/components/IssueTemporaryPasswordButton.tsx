"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound } from "lucide-react";
import { issueTemporaryPassword } from "@/app/personnel/actions";
import { Button } from "@/components/ui/Button";

export function IssueTemporaryPasswordButton({
  userId,
  hasPasswordIssued,
  disabled,
}: {
  userId: string;
  hasPasswordIssued: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const label = hasPasswordIssued ? "Issue new temporary password" : "Issue temporary password";

  async function copyPassword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the password. Select it and copy manually.");
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || pending}
        onClick={() => {
          if (
            !window.confirm(
              hasPasswordIssued
                ? "Replace their current password with a new temporary password? They will have to change it on next sign-in. Share it with them directly; it will not be emailed."
                : "Generate a temporary password for this person? Share it with them directly; it will not be emailed. They will have to change it on first sign-in."
            )
          ) {
            return;
          }
          setError(null);
          setPassword(null);
          setCopied(false);
          startTransition(async () => {
            try {
              const result = await issueTemporaryPassword({ userId });
              setPassword(result.password);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to issue password");
            }
          });
        }}
      >
        <KeyRound className="h-4 w-4" />
        {pending ? "Issuing…" : label}
      </Button>
      {password ? (
        <div className="max-w-sm space-y-2 rounded-md border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Temporary password (shown once)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background px-2 py-1 text-sm">{password}</code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void copyPassword(password)}
              aria-label="Copy temporary password"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Give this to them in person or by a private message. They will be asked to choose a new
            password on first sign-in.
          </p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
