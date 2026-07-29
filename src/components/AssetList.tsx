import type { AssetListRow } from "@/lib/assets-types";
import {
  apparatusTypeLabel,
  assetStatusLabel,
  ppeCategoryLabel,
} from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import Link from "next/link";

function isOverdue(date: string | null | undefined) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${date}T00:00:00`);
  return due < today;
}

function isExpired(date: string | null | undefined) {
  return isOverdue(date);
}

function formatCheckTime(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function assigneeName(asset: AssetListRow) {
  return asset.assignee?.display_name || asset.assignee?.email || "Unassigned";
}

export function AssetList({
  rows,
  kind,
  isAdmin,
  emptyMessage,
}: {
  rows: AssetListRow[];
  kind: "ppe" | "apparatus";
  isAdmin: boolean;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((asset) => {
        const overdueInspection = kind === "ppe" && isOverdue(asset.latest_next_due_on);
        const expired = kind === "ppe" && isExpired(asset.expires_on);
        const lastDaily = formatCheckTime(asset.latest_daily_checked_at);
        const lastWeekly = formatCheckTime(asset.latest_weekly_checked_at);

        return (
          <Card key={asset.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{assetStatusLabel(asset.status)}</Badge>
                  {kind === "ppe" && asset.ppe_category ? (
                    <Badge variant="outline">{ppeCategoryLabel(asset.ppe_category)}</Badge>
                  ) : null}
                  {kind === "apparatus" && asset.apparatus_type ? (
                    <Badge variant="outline">{apparatusTypeLabel(asset.apparatus_type)}</Badge>
                  ) : null}
                  <Badge variant="outline">{asset.station}</Badge>
                  {overdueInspection ? (
                    <Badge variant="destructive">Inspection overdue</Badge>
                  ) : null}
                  {expired ? <Badge variant="destructive">Expired</Badge> : null}
                </div>
                <CardTitle className="truncate">{asset.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {kind === "ppe" ? (
                    <>
                      {isAdmin ? <>Assigned to {assigneeName(asset)} · </> : null}
                      {asset.size ? <>Size {asset.size} · </> : null}
                      {asset.expires_on ? <>Expires {asset.expires_on}</> : "No expiration set"}
                    </>
                  ) : (
                    <>
                      {asset.unit_number ? <>Unit {asset.unit_number}</> : "No unit number"}
                      {asset.build_number ? <> · Build {asset.build_number}</> : null}
                      {asset.year ? <> · {asset.year}</> : null}
                    </>
                  )}
                </p>
                {kind === "ppe" ? (
                  asset.latest_next_due_on ? (
                    <p
                      className={cn(
                        "text-sm",
                        overdueInspection ? "font-medium text-destructive" : "text-muted-foreground"
                      )}
                    >
                      Next inspection due {asset.latest_next_due_on}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No inspections logged</p>
                  )
                ) : lastDaily || lastWeekly ? (
                  <div className="space-y-0.5 text-sm text-muted-foreground">
                    <p>Last daily check: {lastDaily ?? "—"}</p>
                    <p>Last weekly check: {lastWeekly ?? "—"}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No vehicle checks logged</p>
                )}
              </div>
              <Button variant="outline" asChild>
                <Link href={`/assets/${asset.id}`}>View</Link>
              </Button>
            </CardHeader>
            {asset.notes ? (
              <CardContent>
                <p className="line-clamp-2 text-sm text-muted-foreground">{asset.notes}</p>
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
