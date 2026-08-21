"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  grantPlatformOperator,
  revokePlatformOperator,
  type PlatformOperatorRow,
} from "@/app/admin/platform-operators/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export function PlatformOperatorsAdminUi({ operators }: { operators: PlatformOperatorRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rowLoading, setRowLoading] = useState<string | null>(null);

  async function onGrant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await grantPlatformOperator(email);
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant access");
    } finally {
      setLoading(false);
    }
  }

  async function onRevoke(operator: PlatformOperatorRow) {
    setError(null);
    setRowLoading(operator.id);
    try {
      await revokePlatformOperator(operator.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove access");
    } finally {
      setRowLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Grant access</CardTitle>
          <CardDescription>
            The person must already have an account. They will disappear from every department
            personnel list and can switch into any silo. They need to sign in again after being
            granted access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onGrant} className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="sm:flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Granting..." : "Grant"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Operators</CardTitle>
          <CardDescription>Home department is kept for the account record only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {operators.length === 0 ? (
            <p className="text-sm text-muted-foreground">No platform operators yet.</p>
          ) : (
            operators.map((operator) => (
              <div
                key={operator.id}
                className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {operator.display_name || operator.email || "Unnamed"}
                  </p>
                  <p className="text-xs text-muted-foreground">{operator.email}</p>
                  {operator.client_code ? (
                    <p className="text-xs text-muted-foreground">
                      Home: {operator.client_code}
                      {operator.client_name ? ` · ${operator.client_name}` : ""}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={rowLoading === operator.id}
                  onClick={() => onRevoke(operator)}
                >
                  {rowLoading === operator.id ? "Removing..." : "Remove"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
