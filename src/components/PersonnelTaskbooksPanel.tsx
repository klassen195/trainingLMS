"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  approvePersonnelTaskbook,
  completePersonnelTaskbook,
  deletePersonnelTaskbook,
  denyPersonnelTaskbook,
  issuePersonnelTaskbook,
  requestPersonnelTaskbook,
  setPersonnelTaskbookPrerequisiteCheck,
  updatePersonnelTaskbookCompletedOn,
} from "@/app/personnel/actions";
import type {
  PersonnelTaskbook,
  PersonnelTaskbookPrerequisiteCheck,
} from "@/lib/personnel-types";
import {
  addYearsToDate,
  isTaskbookOverdue,
  personnelDisplayName,
  taskbookStatusLabel,
} from "@/lib/personnel-types";
import {
  autoIssuedTaskbooks,
  getTaskbookPrerequisites,
  requestableTaskbooks,
  taskbookGroups,
  taskbookRanks,
  type TaskbookGroupId,
} from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";

function prereqKey(rank: string, prerequisiteId: string) {
  return `${rank}::${prerequisiteId}`;
}

function statusBadgeClass(taskbook: PersonnelTaskbook) {
  if (taskbook.status === "completed") {
    return "border-transparent bg-emerald-100 text-emerald-800";
  }
  if (taskbook.status === "denied") {
    return "border-transparent bg-slate-200 text-slate-700";
  }
  if (taskbook.status === "requested") {
    return "border-transparent bg-sky-100 text-sky-900";
  }
  if (isTaskbookOverdue(taskbook)) {
    return "border-transparent bg-destructive text-destructive-foreground";
  }
  return "border-transparent bg-amber-100 text-amber-900";
}

function isAutoIssued(rank: string) {
  return (autoIssuedTaskbooks as readonly string[]).includes(rank);
}

function catalogIndex(rank: string) {
  const index = (taskbookRanks as readonly string[]).indexOf(rank);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function groupRanks(ranks: readonly string[]) {
  const rankSet = new Set(ranks);
  return taskbookGroups
    .map((group) => ({
      id: group.id,
      label: group.label,
      ranks: group.ranks.filter((rank) => rankSet.has(rank)),
    }))
    .filter((group) => group.ranks.length > 0);
}

function groupTaskbooks(taskbooks: PersonnelTaskbook[]) {
  const byRank = new Map<string, PersonnelTaskbook[]>();
  for (const taskbook of taskbooks) {
    const list = byRank.get(taskbook.rank) ?? [];
    list.push(taskbook);
    byRank.set(taskbook.rank, list);
  }

  const known = new Set(taskbookRanks as readonly string[]);
  const grouped: {
    id: TaskbookGroupId | "other";
    label: string;
    taskbooks: PersonnelTaskbook[];
  }[] = taskbookGroups
    .map((group) => ({
      id: group.id as TaskbookGroupId,
      label: group.label,
      taskbooks: group.ranks.flatMap((rank) => byRank.get(rank) ?? []),
    }))
    .filter((group) => group.taskbooks.length > 0);

  const other = taskbooks
    .filter((t) => !known.has(t.rank))
    .sort((a, b) => catalogIndex(a.rank) - catalogIndex(b.rank));
  if (other.length > 0) {
    grouped.push({ id: "other", label: "Other", taskbooks: other });
  }
  return grouped;
}

export function PersonnelTaskbooksPanel({
  profileId,
  taskbooks,
  prerequisiteChecks = [],
  pendingApprovals = [],
  canRequest,
  canCheckPrerequisites,
  canDecide,
  canIssue,
  hasSupervisor,
}: {
  profileId: string;
  taskbooks: PersonnelTaskbook[];
  prerequisiteChecks?: PersonnelTaskbookPrerequisiteCheck[];
  pendingApprovals?: PersonnelTaskbook[];
  canRequest: boolean;
  canCheckPrerequisites: boolean;
  canDecide: boolean;
  canIssue: boolean;
  hasSupervisor: boolean;
}) {
  const [applyingRank, setApplyingRank] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  const checkedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const check of prerequisiteChecks) {
      set.add(prereqKey(check.rank, check.prerequisite_id));
    }
    return set;
  }, [prerequisiteChecks]);

  const openRanks = useMemo(() => {
    const taken = new Set(
      taskbooks
        .filter((t) => t.status === "requested" || t.status === "active" || t.status === "completed")
        .map((t) => t.rank)
    );
    return taskbookRanks.filter((rank) => !taken.has(rank));
  }, [taskbooks]);

  const availableForIssue = useMemo(
    () => openRanks.filter((rank) => !isAutoIssued(rank) || canIssue),
    [openRanks, canIssue]
  );

  const availableGroups = useMemo(() => groupRanks(openRanks), [openRanks]);
  const myTaskbookGroups = useMemo(() => groupTaskbooks(taskbooks), [taskbooks]);
  const issueGroups = useMemo(() => groupRanks(availableForIssue), [availableForIssue]);

  return (
    <div className="space-y-4">
      {pendingApprovals.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending requests from your crew</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-3">
              {pendingApprovals.map((taskbook) => (
                <PendingApprovalRow key={taskbook.id} taskbook={taskbook} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 gap-2 pb-3">
          <CardTitle className="text-base">My taskbooks</CardTitle>
          {canIssue ? (
            issuing ? null : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={availableForIssue.length === 0}
                onClick={() => setIssuing(true)}
              >
                Issue taskbook
              </Button>
            )
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {taskbooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No taskbooks yet.</p>
          ) : (
            <div className="space-y-6">
              {myTaskbookGroups.map((group) => (
                <div key={group.id} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </h3>
                  <ul className="space-y-3">
                    {group.taskbooks.map((taskbook) => (
                      <TaskbookRow
                        key={taskbook.id}
                        taskbook={taskbook}
                        checkedKeys={checkedKeys}
                        canCheckPrerequisites={canCheckPrerequisites}
                        canDecide={canDecide}
                        canIssue={canIssue}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {issuing ? (
            <div className="rounded-lg border p-4">
              <IssueTaskbookForm
                profileId={profileId}
                availableRanks={availableForIssue}
                availableGroups={issueGroups}
                onDone={() => setIssuing(false)}
                onCancel={() => setIssuing(false)}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Available taskbooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {openRanks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every taskbook has already been requested, issued, or completed.
            </p>
          ) : (
            <div className="space-y-6">
              {availableGroups.map((group) => (
                <div key={group.id} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </h3>
                  <ul className="space-y-3">
                    {group.ranks.map((rank) => (
                      <AvailableTaskbookRow
                        key={rank}
                        rank={rank}
                        checkedKeys={checkedKeys}
                        canCheckPrerequisites={canCheckPrerequisites}
                        canRequest={canRequest}
                        canIssue={canIssue}
                        hasSupervisor={hasSupervisor}
                        applying={applyingRank === rank}
                        onApply={() => setApplyingRank(rank)}
                        onCancelApply={() => setApplyingRank(null)}
                        onApplied={() => setApplyingRank(null)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {canRequest && !hasSupervisor ? (
            <p className="text-sm text-amber-800">
              You need an assigned captain supervisor or a Battalion Chief on your shift before you
              can apply for a taskbook.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskbookPrerequisites({
  rank,
  checkedKeys,
  canCheck,
}: {
  rank: string;
  checkedKeys: Set<string>;
  canCheck: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const items = getTaskbookPrerequisites(rank);
  if (items.length === 0) return null;

  const checkedCount = items.filter((item) =>
    checkedKeys.has(prereqKey(rank, item.id))
  ).length;

  return (
    <div className="mt-3">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen((value) => !value)}
      >
        Prerequisites ({checkedCount}/{items.length})
      </Button>
      {open ? (
        <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Self-check list before this taskbook is issued. Checking items does not block Apply.
          </p>
          <ul className="space-y-2">
            {items.map((item) => {
              const checked = checkedKeys.has(prereqKey(rank, item.id));
              return (
                <li key={item.id}>
                  <label
                    className={cn(
                      "flex items-start gap-3 text-sm",
                      !canCheck && "cursor-default text-muted-foreground"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={!canCheck || pending}
                      onChange={(e) => {
                        if (!canCheck) return;
                        const next = e.target.checked;
                        setError(null);
                        startTransition(async () => {
                          try {
                            await setPersonnelTaskbookPrerequisiteCheck({
                              rank,
                              prerequisiteId: item.id,
                              checked: next,
                            });
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Could not update");
                          }
                        });
                      }}
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function AvailableTaskbookRow({
  rank,
  checkedKeys,
  canCheckPrerequisites,
  canRequest,
  canIssue,
  hasSupervisor,
  applying,
  onApply,
  onCancelApply,
  onApplied,
}: {
  rank: string;
  checkedKeys: Set<string>;
  canCheckPrerequisites: boolean;
  canRequest: boolean;
  canIssue: boolean;
  hasSupervisor: boolean;
  applying: boolean;
  onApply: () => void;
  onCancelApply: () => void;
  onApplied: () => void;
}) {
  const autoIssued = isAutoIssued(rank);
  const requestable = (requestableTaskbooks as readonly string[]).includes(rank);

  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{rank}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {autoIssued
              ? "Issued automatically upon hire."
              : "Apply to request this taskbook from your supervisor."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {autoIssued ? (
            <Badge className="border-transparent bg-slate-200 text-slate-700">Issued on hire</Badge>
          ) : null}
          {canRequest && requestable ? (
            applying ? null : (
              <Button
                type="button"
                size="sm"
                disabled={!hasSupervisor}
                onClick={onApply}
              >
                Apply
              </Button>
            )
          ) : null}
          {canIssue && autoIssued ? (
            <span className="text-xs text-muted-foreground self-center">
              Use Issue below if this person needs a backfill.
            </span>
          ) : null}
        </div>
      </div>
      <TaskbookPrerequisites
        rank={rank}
        checkedKeys={checkedKeys}
        canCheck={canCheckPrerequisites}
      />
      {applying ? (
        <div className="mt-4 border-t pt-4">
          <ApplyTaskbookForm rank={rank} onDone={onApplied} onCancel={onCancelApply} />
        </div>
      ) : null}
    </li>
  );
}

function ApplyTaskbookForm({
  rank,
  onDone,
  onCancel,
}: {
  rank: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await requestPersonnelTaskbook({ rank, notes: notes || undefined });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Request failed");
          }
        });
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor={`apply-notes-${rank}`}>Notes (optional)</FieldLabel>
        <Textarea
          id={`apply-notes-${rank}`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Submitting…" : `Apply for ${rank}`}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TaskbookRow({
  taskbook,
  checkedKeys,
  canCheckPrerequisites,
  canDecide,
  canIssue,
}: {
  taskbook: PersonnelTaskbook;
  checkedKeys: Set<string>;
  canCheckPrerequisites: boolean;
  canDecide: boolean;
  canIssue: boolean;
}) {
  const overdue = isTaskbookOverdue(taskbook);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingCompletedOn, setEditingCompletedOn] = useState(false);
  const [completedOn, setCompletedOn] = useState(taskbook.completed_on?.slice(0, 10) ?? "");

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  const dateLine = [
    taskbook.status === "requested" ? `Requested ${formatDate(taskbook.requested_at)}` : null,
    taskbook.approved_on ? `Approved ${formatDate(taskbook.approved_on)}` : null,
    taskbook.due_on ? `Due ${formatDate(taskbook.due_on)}` : null,
    taskbook.completed_on ? `Completed ${formatDate(taskbook.completed_on)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={cn(
        "rounded-lg border p-4",
        overdue && "border-destructive/50 bg-destructive/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{taskbook.rank} taskbook</p>
            <Badge className={statusBadgeClass(taskbook)}>{taskbookStatusLabel(taskbook)}</Badge>
          </div>
          {dateLine ? (
            <p className="mt-1 text-sm text-muted-foreground">{dateLine}</p>
          ) : null}
          {taskbook.status === "denied" && taskbook.denial_reason ? (
            <p className="mt-1 text-sm text-muted-foreground">Denied: {taskbook.denial_reason}</p>
          ) : null}
          {taskbook.notes ? <p className="mt-2 text-sm">{taskbook.notes}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canDecide && taskbook.status === "requested" ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    approvePersonnelTaskbook({ id: taskbook.id, profileId: taskbook.profile_id })
                  )
                }
              >
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  const reason = window.prompt("Denial reason (optional)");
                  if (reason === null) return;
                  run(() =>
                    denyPersonnelTaskbook({
                      id: taskbook.id,
                      profileId: taskbook.profile_id,
                      reason,
                    })
                  );
                }}
              >
                Deny
              </Button>
            </>
          ) : null}
          {canDecide && taskbook.status === "active" ? (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Mark ${taskbook.rank} taskbook complete?`)) return;
                run(() =>
                  completePersonnelTaskbook({ id: taskbook.id, profileId: taskbook.profile_id })
                );
              }}
            >
              Mark complete
            </Button>
          ) : null}
          {canIssue && taskbook.status === "completed" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setCompletedOn(taskbook.completed_on?.slice(0, 10) ?? "");
                setEditingCompletedOn((open) => !open);
              }}
            >
              {editingCompletedOn ? "Cancel" : "Edit completed date"}
            </Button>
          ) : null}
          {canIssue ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Delete this taskbook record?")) return;
                run(() =>
                  deletePersonnelTaskbook({ id: taskbook.id, profileId: taskbook.profile_id })
                );
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
      <TaskbookPrerequisites
        rank={taskbook.rank}
        checkedKeys={checkedKeys}
        canCheck={canCheckPrerequisites}
      />
      {canIssue && editingCompletedOn && taskbook.status === "completed" ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await updatePersonnelTaskbookCompletedOn({
                id: taskbook.id,
                profileId: taskbook.profile_id,
                completedOn,
              });
              setEditingCompletedOn(false);
            });
          }}
        >
          <div className="space-y-2">
            <FieldLabel htmlFor={`completed-on-${taskbook.id}`}>Completed on</FieldLabel>
            <Input
              id={`completed-on-${taskbook.id}`}
              type="date"
              required
              value={completedOn}
              onChange={(e) => setCompletedOn(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={pending || !completedOn}>
            {pending ? "Saving…" : "Save date"}
          </Button>
        </form>
      ) : null}
    </li>
  );
}

function PendingApprovalRow({ taskbook }: { taskbook: PersonnelTaskbook }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const name = taskbook.profile
    ? personnelDisplayName(taskbook.profile)
    : "Crew member";

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <li className="rounded-lg border border-sky-200 bg-sky-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            <Link href={`/personnel/${taskbook.profile_id}`} className="hover:underline">
              {name}
            </Link>
            {" · "}
            {taskbook.rank} taskbook
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Requested {formatDate(taskbook.requested_at)}
          </p>
          {taskbook.notes ? <p className="mt-2 text-sm">{taskbook.notes}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() =>
                approvePersonnelTaskbook({ id: taskbook.id, profileId: taskbook.profile_id })
              )
            }
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Denial reason (optional)");
              if (reason === null) return;
              run(() =>
                denyPersonnelTaskbook({
                  id: taskbook.id,
                  profileId: taskbook.profile_id,
                  reason,
                })
              );
            }}
          >
            Deny
          </Button>
        </div>
      </div>
    </li>
  );
}

function IssueTaskbookForm({
  profileId,
  availableRanks,
  availableGroups,
  onDone,
  onCancel,
}: {
  profileId: string;
  availableRanks: readonly string[];
  availableGroups: readonly { id: string; label: string; ranks: readonly string[] }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [rank, setRank] = useState(availableRanks[0] ?? "");
  const [approvedOn, setApprovedOn] = useState(today);
  const [dueOn, setDueOn] = useState(addYearsToDate(today, 1));
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await issuePersonnelTaskbook({
              profileId,
              rank,
              approvedOn,
              dueOn,
              notes: notes || undefined,
            });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Issue failed");
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <FieldLabel htmlFor="issue-rank">Taskbook</FieldLabel>
          <Select id="issue-rank" required value={rank} onChange={(e) => setRank(e.target.value)}>
            {availableGroups.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.ranks.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="issue-approved">Approved on</FieldLabel>
          <Input
            id="issue-approved"
            type="date"
            required
            value={approvedOn}
            onChange={(e) => {
              setApprovedOn(e.target.value);
              setDueOn(addYearsToDate(e.target.value || today, 1));
            }}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="issue-due">Due on</FieldLabel>
          <Input
            id="issue-due"
            type="date"
            required
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <FieldLabel htmlFor="issue-notes">Notes (optional)</FieldLabel>
          <Textarea
            id="issue-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !rank}>
          {pending ? "Issuing…" : "Issue taskbook"}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
