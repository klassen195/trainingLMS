import Link from "next/link";
import type {
  PersonnelProfile,
  PersonnelQualification,
  PersonnelTaskbook,
} from "@/lib/personnel-types";
import {
  formatSwingUpRanks,
  familyDateEventLabel,
  familyDateTitle,
  isCertExpired,
  isRankOnProbation,
  isTaskbookOverdue,
  personnelDisplayName,
  personnelShiftLabel,
  rankHasTitle,
  taskbookStatusLabel,
  taskbookTimeLeftLabel,
  upcomingFamilyDates,
  upcomingImportantDateWhenLabel,
} from "@/lib/personnel-types";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

function personInitials(person: PersonnelProfile) {
  const first = person.first_name?.trim()?.[0];
  const last = person.last_name?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  const name = personnelDisplayName(person).trim();
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function SupervisorDashboard({
  rows,
  taskbooksByProfile,
  qualificationsByProfile,
}: {
  rows: PersonnelProfile[];
  taskbooksByProfile: Record<string, PersonnelTaskbook[]>;
  qualificationsByProfile: Record<string, PersonnelQualification[]>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border py-8 text-center">
        <p className="text-sm text-muted-foreground">No personnel assigned to you.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
      {rows.map((person) => {
        const onProbation = isRankOnProbation(person.rank, person.rank_promoted_on);
        const station = person.primary_location?.name || "—";
        const shift = personnelShiftLabel(person.shift);
        const openBooks = taskbooksByProfile[person.id] ?? [];
        const qualifications = qualificationsByProfile[person.id] ?? [];
        const upcomingDates = upcomingFamilyDates(person);
        return (
          <Card key={person.id} className="flex flex-col">
            <CardHeader className="flex-row items-start gap-3 space-y-0 p-4">
              {/* Photo placeholder — swap in AvatarImage when profile photos exist */}
              <Avatar className="h-14 w-14 rounded-md">
                <AvatarFallback className="rounded-md text-base font-medium">
                  {personInitials(person)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <CardTitle className="text-lg leading-snug">
                    <Link
                      href={`/personnel/${person.id}`}
                      className="hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {personnelDisplayName(person)}
                    </Link>
                  </CardTitle>
                  {onProbation ? (
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-900"
                    >
                      Probation
                    </Badge>
                  ) : null}
                </div>
                {person.employee_number ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {person.employee_number}
                  </p>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 p-4 pt-0">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Station</dt>
                  <dd className="mt-0.5 font-medium">{station}</dd>
                  {person.shift ? (
                    <dd className="text-xs text-muted-foreground">{shift}</dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">EMS</dt>
                  <dd className="mt-0.5 font-medium">
                    {person.ems_cleared_level?.name || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Rank</dt>
                  <dd className="mt-0.5 font-medium">{person.rank || "—"}</dd>
                  {rankHasTitle(person.rank) && person.job_title ? (
                    <dd className="text-xs text-muted-foreground">{person.job_title}</dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Swing-up</dt>
                  <dd className="mt-0.5 font-medium">{formatSwingUpRanks(person.swing_up)}</dd>
                </div>
              </dl>

              {upcomingDates.length > 0 ? (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Upcoming dates
                  </p>
                  <ul className="space-y-1.5">
                    {upcomingDates.map((item) => {
                      const roleLabel =
                        item.role === "anniversary"
                          ? null
                          : item.name
                            ? familyDateEventLabel(item)
                            : null;
                      return (
                        <li
                          key={`${item.role}-${item.name ?? ""}-${item.nextOn}`}
                          className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="font-medium">{familyDateTitle(item)}</span>
                            {roleLabel ? (
                              <span className="text-muted-foreground"> · {roleLabel}</span>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(item.nextOn)} ·{" "}
                            {upcomingImportantDateWhenLabel(item.daysUntil)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Qualifications
                </p>
                {qualifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None recorded</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {qualifications.map((row) => {
                      const expired = isCertExpired(row.expires_on);
                      const name = row.qualification?.name ?? "Qualification";
                      return (
                        <li key={row.id}>
                          <Badge
                            variant="outline"
                            className={cn(
                              "max-w-full font-normal",
                              expired &&
                                "border-destructive/40 bg-destructive/10 text-destructive"
                            )}
                            title={
                              row.expires_on
                                ? `${name} · Expires ${formatDate(row.expires_on)}`
                                : name
                            }
                          >
                            <span className="truncate">{name}</span>
                            {expired ? <span className="ml-1 shrink-0">· Expired</span> : null}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-auto border-t pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Open taskbooks
                </p>
                {openBooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open taskbooks</p>
                ) : (
                  <ul className="space-y-2">
                    {openBooks.map((book) => (
                      <OpenTaskbookItem key={book.id} taskbook={book} />
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function OpenTaskbookItem({ taskbook }: { taskbook: PersonnelTaskbook }) {
  const overdue = isTaskbookOverdue(taskbook);
  const awaiting = taskbook.status === "requested";
  const timeLabel = awaiting
    ? "Awaiting approval"
    : taskbookTimeLeftLabel(taskbook.due_on);

  return (
    <li className="rounded-md border bg-muted/20 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{taskbook.rank}</span>
        <Badge
          variant="outline"
          className={
            overdue
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : awaiting
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : undefined
          }
        >
          {taskbookStatusLabel(taskbook)}
        </Badge>
      </div>
      <div
        className={`mt-0.5 text-xs ${
          overdue ? "font-medium text-destructive" : "text-muted-foreground"
        }`}
      >
        {timeLabel}
      </div>
    </li>
  );
}
