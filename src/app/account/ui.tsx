"use client";

import { useState, useTransition } from "react";
import { setAccountPassword } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldHint, FieldLabel, FieldSuccess } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function AccountPasswordForm() {
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save password");
      }
    });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Password sign-in</CardTitle>
        <CardDescription>
          Set a password to sign in without waiting for email. You can still use magic link or email code anytime.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <Input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <FieldHint>At least 8 characters.</FieldHint>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save password"}
          </Button>
          {saved ? <FieldSuccess>Password saved. You can sign in with the Password tab next time.</FieldSuccess> : null}
          {error ? <FieldError>{error}</FieldError> : null}
        </form>
      </CardContent>
    </Card>
  );
}
