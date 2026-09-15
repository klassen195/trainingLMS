import Link from "next/link";
import { formatDate } from "@/lib/dates";
import {
  formatEstimatedCost,
  upcomingTrainingStatusLabel,
  type UpcomingTrainingListItem,
} from "@/lib/upcoming-training-types";
import { Badge } from "@/components/ui/Badge";

function statusVariant(status: UpcomingTrainingListItem["status"]) {
  switch (status) {
    case "open":
      return "default" as const;
    case "draft":
      return "secondary" as const;
    case "closed":
      return "outline" as const;
    case "cancelled":
      return "destructive" as const;
  }
}

export function UpcomingTrainingTable({
  rows,
  emptyMessage,
  showStatus = false,
}: {
  rows: UpcomingTrainingListItem[];
  emptyMessage: string;
  showStatus?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border py-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Provider</th>
            <th className="px-3 py-2 font-medium">Dates</th>
            <th className="px-3 py-2 font-medium">Deadline</th>
            <th className="px-3 py-2 font-medium">Cost</th>
            {showStatus ? <th className="px-3 py-2 font-medium">Status</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2">
                <Link
                  href={`/document-training/upcoming/${row.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.title}
                </Link>
                {row.location ? (
                  <div className="text-xs text-muted-foreground">{row.location}</div>
                ) : null}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.provider || "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {row.starts_on ? formatDate(row.starts_on) : "—"}
                {row.ends_on && row.ends_on !== row.starts_on
                  ? ` – ${formatDate(row.ends_on)}`
                  : ""}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {row.application_deadline ? formatDate(row.application_deadline) : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatEstimatedCost(row.estimated_cost)}
              </td>
              {showStatus ? (
                <td className="px-3 py-2">
                  <Badge variant={statusVariant(row.status)}>
                    {upcomingTrainingStatusLabel(row.status)}
                  </Badge>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
