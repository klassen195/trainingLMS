"use client";

import type { MaintenanceRequestWithRequester } from "@/lib/maintenance-types";
import {
  maintenanceRequestStatusBadgeClass,
  maintenanceRequestStatusLabel,
  maintenanceRequestTypeLabel,
  maintenanceServiceStatusLabel,
} from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/dates";

function formatPerson(
  person: { display_name: string | null; email: string | null } | null | undefined
) {
  return person?.display_name || person?.email || "Unknown";
}

export function MaintenanceRequestHistory({
  requests,
}: {
  requests: MaintenanceRequestWithRequester[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Maintenance requests</CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No maintenance requests yet.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="rounded-md border border-border px-3 py-3 text-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
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
                <p className="font-medium text-foreground">{request.title}</p>
                {request.description.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{request.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Requested by {formatPerson(request.requester)} ·{" "}
                  {formatDateTime(request.requested_at)}
                </p>
                {request.photo_url ? (
                  <a
                    href={request.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block overflow-hidden rounded-md border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={request.photo_url}
                      alt={request.photo_file_name || "Maintenance photo"}
                      className="max-h-56 w-full object-contain bg-muted/40"
                    />
                  </a>
                ) : null}
                {request.status === "resolved" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Resolved {request.resolved_at ? formatDateTime(request.resolved_at) : ""}
                    {request.resolved_note ? ` — ${request.resolved_note}` : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
