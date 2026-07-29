"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveMaintenanceRequest } from "@/app/assets/maintenance-actions";
import { assetDisplayLabel } from "@/lib/assets-types";
import type { MaintenanceRequestWithAsset } from "@/lib/maintenance-types";
import {
  maintenanceRequestStatusBadgeClass,
  maintenanceRequestStatusLabel,
  maintenanceRequestTypeLabel,
  maintenanceServiceStatusLabel,
} from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";

function formatPerson(
  person: { display_name: string | null; email: string | null } | null | undefined
) {
  return person?.display_name || person?.email || "Unknown";
}

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function MaintenanceRequestAdminList({
  requests,
}: {
  requests: MaintenanceRequestWithAsset[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvedNote, setResolvedNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => requests.filter((request) => request.status === tab),
    [requests, tab]
  );

  function resolveNow(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await resolveMaintenanceRequest({
          requestId: id,
          resolvedNote: resolvedNote.trim() || undefined,
        });
        setResolvingId(null);
        setResolvedNote("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resolve request");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Maintenance requests</CardTitle>
            <CardDescription>Open requests and resolved history.</CardDescription>
          </div>
          <div className="inline-flex rounded-md border border-input bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setTab("open")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "open"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setTab("resolved")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "resolved"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              Resolved
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <FieldError>{error}</FieldError> : null}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tab === "open" ? "No open maintenance requests." : "No resolved requests yet."}
          </p>
        ) : (
          filtered.map((request) => {
            const assetLabel = request.asset
              ? assetDisplayLabel(request.asset)
              : "Unknown apparatus";
            return (
              <div
                key={request.id}
                className="rounded-md border border-border px-3 py-3 text-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{assetLabel}</span>
                  <Badge className={maintenanceRequestStatusBadgeClass(request.status)}>
                    {maintenanceRequestStatusLabel(request.status)}
                  </Badge>
                  <Badge variant="outline">
                    {maintenanceRequestTypeLabel(request.request_type)}
                  </Badge>
                  <Badge variant="outline">
                    {maintenanceServiceStatusLabel(request.service_status)}
                  </Badge>
                </div>
                <p className="font-medium">{request.title}</p>
                {request.description.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap">{request.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Requested by {formatPerson(request.requester)} ·{" "}
                  {formatTimestamp(request.requested_at)}
                  {request.asset?.station ? ` · ${request.asset.station}` : ""}
                </p>
                {request.photo_url ? (
                  <a
                    href={request.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    View photo
                  </a>
                ) : null}
                {request.status === "open" ? (
                  <div className="mt-3 space-y-2">
                    {resolvingId === request.id ? (
                      <>
                        <Textarea
                          value={resolvedNote}
                          onChange={(e) => setResolvedNote(e.target.value)}
                          placeholder="Resolution note (optional)"
                          rows={3}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() => resolveNow(request.id)}
                          >
                            {pending ? "Resolving..." : "Confirm resolve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => {
                              setResolvingId(null);
                              setResolvedNote("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResolvingId(request.id);
                          setResolvedNote("");
                          setError(null);
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                ) : request.resolved_note ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Resolution: {request.resolved_note}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
