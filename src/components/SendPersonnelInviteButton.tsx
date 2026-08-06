"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { sendPersonnelInvite } from "@/app/personnel/actions";
import { Button } from "@/components/ui/Button";

export function SendPersonnelInviteButton({
  userId,
  hasBeenInvited,
  disabled,
}: {
  userId: string;
  hasBeenInvited: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const label = hasBeenInvited ? "Resend invite" : "Send invite";

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || pending}
        onClick={() => {
          if (
            !window.confirm(
              hasBeenInvited
                ? "Resend a sign-in invite email to this person?"
                : "Send a sign-in invite email to this person?"
            )
          ) {
            return;
          }
          setError(null);
          setSent(false);
          startTransition(async () => {
            try {
              await sendPersonnelInvite({ userId });
              setSent(true);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to send invite");
            }
          });
        }}
      >
        <Mail className="h-4 w-4" />
        {pending ? "Sending…" : sent ? "Invite sent" : label}
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {sent && !error ? (
        <p className="text-sm text-muted-foreground">Invite email sent.</p>
      ) : null}
    </div>
  );
}
