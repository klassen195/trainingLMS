import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { personnelDisplayName } from "@/lib/personnel-types";
import {
  formatEstimatedCost,
  trainingAttendanceStageLabel,
  type TrainingAttendanceRequestListItem,
} from "@/lib/upcoming-training-types";
import { Badge } from "@/components/ui/Badge";

function stageVariant(stage: TrainingAttendanceRequestListItem["current_stage"]) {
  switch (stage) {
    case "approved":
      return "default" as const;
    case "denied":
    case "withdrawn":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export function TrainingAttendanceRequestsTable({
  rows,
  emptyMessage,
  showApplicant = false,
}: {
  rows: TrainingAttendanceRequestListItem[];
  emptyMessage: string;
  showApplicant?: boolean;
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
            {showApplicant ? <th className="px-3 py-2 font-medium">Applicant</th> : null}
            <th className="px-3 py-2 font-medium">Training</th>
            <th className="px-3 py-2 font-medium">Dates</th>
            <th className="px-3 py-2 font-medium">Cost</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
              {showApplicant ? (
                <td className="px-3 py-2">
                  {row.applicant ? personnelDisplayName(row.applicant) : "—"}
                </td>
              ) : null}
              <td className="px-3 py-2">
                <Link
                  href={`/document-training/requests/${row.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.title}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {row.upcoming_training_id ? "Listed opportunity" : "Unlisted request"}
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {row.starts_on ? formatDate(row.starts_on) : "—"}
                {row.ends_on && row.ends_on !== row.starts_on
                  ? ` – ${formatDate(row.ends_on)}`
                  : ""}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatEstimatedCost(row.estimated_cost)}
              </td>
              <td className="px-3 py-2">
                <Badge variant={stageVariant(row.current_stage)}>
                  {trainingAttendanceStageLabel(row.current_stage)}
                </Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatDate(row.created_at.slice(0, 10))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
