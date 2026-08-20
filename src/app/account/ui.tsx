"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAccountPassword } from "@/app/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-password";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldHint, FieldLabel, FieldSuccess } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function AccountPasswordForm({
  title = "Password",
  description = "Update the password you use to sign in.",
  submitLabel = "Save password",
  successMessage = "Password saved.",
  redirectTo,
}: {
  title?: string;
  description?: string;
  submitLabel?: string;
  successMessage?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await setAccountPassword({ password, confirmPassword });
        if (result.error) {
          setError(result.error);
          return;
        }
        setPassword("");
        setConfirmPassword("");
        setSaved(true);
        if (redirectTo) {
          router.push(redirectTo);
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save password");
      }
    });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <Input
              id="new-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <FieldHint>At least {MIN_PASSWORD_LENGTH} characters.</FieldHint>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : submitLabel}
          </Button>
          {saved && !redirectTo ? <FieldSuccess>{successMessage}</FieldSuccess> : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </form>
      </CardContent>
    </Card>
  );
}
