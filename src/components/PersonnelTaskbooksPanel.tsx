"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  approvePersonnelTaskbook,
  completePersonnelTaskbook,
  deletePersonnelTaskbook,
  denyPersonnelTaskbook,
  getPersonnelTaskbookDownloadUrl,
  issuePersonnelTaskbook,
  requestPersonnelTaskbook,
  setPersonnelTaskbookPrerequisiteCheck,
  updatePersonnelTaskbookCompletion,
} from "@/app/personnel/actions";
import type {
  PersonnelTaskbook,
  PersonnelTaskbookPrerequisiteCheck,
} from "@/lib/personnel-types";
import {
  addYearsToDate,
  isPersonnelDocumentFile,
  isTaskbookOverdue,
  PERSONNEL_DOCUMENT_ACCEPT,
  PERSONNEL_DOCUMENTS_BUCKET,
  personnelDisplayName,
  taskbookStatusLabel,
} from "@/lib/personnel-types";
import { fileAsJpegIfHeic } from "@/lib/heic";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { CertificationFilePreview } from "@/components/CertificationFilePreview";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import {
  groupTaskbookCatalog,
  findTaskbookTypeByName,
  type TaskbookTypeWithPrerequisites,
} from "@/lib/taskbook-types";

async function uploadTaskbookFile(storagePath: string, token: string, file: File) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(PERSONNEL_DOCUMENTS_BUCKET)
    .uploadToSignedUrl(storagePath, token, file, {
      contentType: file.type || undefined,
    });
  if (error) throw new Error(error.message);
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

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

function catalogIndex(catalog: readonly TaskbookTypeWithPrerequisites[], rank: string) {
  const index = catalog.findIndex((type) => type.name === rank);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function groupOpenRanks(
  catalog: readonly TaskbookTypeWithPrerequisites[],
  ranks: readonly string[]
) {
  const rankSet = new Set(ranks);
  return groupTaskbookCatalog(catalog)
    .map((group) => ({
      id: group.key,
      label: group.label,
      ranks: group.types.map((type) => type.name).filter((rank) => rankSet.has(rank)),
    }))
    .filter((group) => group.ranks.length > 0);
}

function groupAssignedTaskbooks(
  catalog: readonly TaskbookTypeWithPrerequisites[],
  taskbooks: PersonnelTaskbook[]
) {
  const byRank = new Map<string, PersonnelTaskbook[]>();
  for (const taskbook of taskbooks) {
    const list = byRank.get(taskbook.rank) ?? [];
    list.push(taskbook);
    byRank.set(taskbook.rank, list);
  }

  const known = new Set(catalog.map((type) => type.name));
  const grouped = groupTaskbookCatalog(catalog)
    .map((group) => ({
      id: group.key,
      label: group.label,
      taskbooks: group.types.flatMap((type) => byRank.get(type.name) ?? []),
    }))
    .filter((group) => group.taskbooks.length > 0);

  const other = taskbooks
    .filter((t) => !known.has(t.rank))
    .sort((a, b) => catalogIndex(catalog, a.rank) - catalogIndex(catalog, b.rank));
  if (other.length > 0) {
    grouped.push({ id: "other", label: "Other", taskbooks: other });
  }
  return grouped;
}

export function PersonnelTaskbooksPanel({
  profileId,
  taskbooks,
  catalog,
  prerequisiteChecks = [],
  pendingApprovals = [],
  canRequest,
  canCheckPrerequisites,
  canDecide,
  canIssue,
  hasSupervisor,
  pdipEnabled = false,
}: {
  profileId: string;
  taskbooks: PersonnelTaskbook[];
  catalog: TaskbookTypeWithPrerequisites[];
  prerequisiteChecks?: PersonnelTaskbookPrerequisiteCheck[];
  pendingApprovals?: PersonnelTaskbook[];
  canRequest: boolean;
  canCheckPrerequisites: boolean;
  canDecide: boolean;
  canIssue: boolean;
  hasSupervisor: boolean;
  pdipEnabled?: boolean;
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

  const activeCatalog = useMemo(
    () => catalog.filter((type) => type.is_active),
    [catalog]
  );

  const openTypes = useMemo(() => {
    const taken = new Set(
      taskbooks
        .filter((t) => t.status === "requested" || t.status === "active" || t.status === "completed")
        .map((t) => t.rank)
    );
    return activeCatalog.filter((type) => !taken.has(type.name));
  }, [taskbooks, activeCatalog]);

  const openRanks = useMemo(() => openTypes.map((type) => type.name), [openTypes]);

  const availableForIssue = useMemo(
    () =>
      openTypes
        .filter((type) => !type.auto_issued || canIssue)
        .map((type) => type.name),
    [openTypes, canIssue]
  );

  const availableGroups = useMemo(
    () => groupOpenRanks(activeCatalog, openRanks),
    [activeCatalog, openRanks]
  );
  const myTaskbookGroups = useMemo(
    () => groupAssignedTaskbooks(catalog, taskbooks),
    [catalog, taskbooks]
  );
  const issueGroups = useMemo(
    () => groupOpenRanks(activeCatalog, availableForIssue),
    [activeCatalog, availableForIssue]
  );

  const prereqByRank = useMemo(() => {
    const map = new Map<string, { id: string; label: string }[]>();
    for (const type of catalog) {
      map.set(
        type.name,
        type.prerequisites.map((item) => ({ id: item.code, label: item.label }))
      );
    }
    return map;
  }, [catalog]);

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
                        prerequisites={prereqByRank.get(taskbook.rank) ?? []}
                        checkedKeys={checkedKeys}
                        canCheckPrerequisites={canCheckPrerequisites}
                        canDecide={canDecide}
                        canIssue={canIssue}
                        pdipEnabled={pdipEnabled}
                        countsForPdip={Boolean(
                          findTaskbookTypeByName(catalog, taskbook.rank)?.pdip_eligible
                        )}
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
                    {group.ranks.map((rank) => {
                      const type = findTaskbookTypeByName(activeCatalog, rank);
                      return (
                        <AvailableTaskbookRow
                          key={rank}
                          rank={rank}
                          autoIssued={Boolean(type?.auto_issued)}
                          requestable={Boolean(type?.requestable && !type?.auto_issued)}
                          prerequisites={prereqByRank.get(rank) ?? []}
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
                      );
                    })}
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
  prerequisites,
  checkedKeys,
  canCheck,
}: {
  rank: string;
  prerequisites: readonly { id: string; label: string }[];
  checkedKeys: Set<string>;
  canCheck: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const items = prerequisites;
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
  autoIssued,
  requestable,
  prerequisites,
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
  autoIssued: boolean;
  requestable: boolean;
  prerequisites: readonly { id: string; label: string }[];
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
        prerequisites={prerequisites}
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
  prerequisites,
  checkedKeys,
  canCheckPrerequisites,
  canDecide,
  canIssue,
  pdipEnabled,
  countsForPdip,
}: {
  taskbook: PersonnelTaskbook;
  prerequisites: readonly { id: string; label: string }[];
  checkedKeys: Set<string>;
  canCheckPrerequisites: boolean;
  canDecide: boolean;
  canIssue: boolean;
  pdipEnabled: boolean;
  countsForPdip: boolean;
}) {
  const router = useRouter();
  const overdue = isTaskbookOverdue(taskbook);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [editingCompletion, setEditingCompletion] = useState(false);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
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
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {taskbook.storage_path ? (
            <TaskbookFilePreview
              id={taskbook.id}
              profileId={taskbook.profile_id}
              mimeType={taskbook.mime_type}
              fileName={taskbook.file_name}
            />
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{taskbook.rank} taskbook</p>
              <Badge className={statusBadgeClass(taskbook)}>{taskbookStatusLabel(taskbook)}</Badge>
              {pdipEnabled && taskbook.status === "completed" && countsForPdip ? (
                <span className="text-xs text-muted-foreground">PDIP</span>
              ) : null}
            </div>
            {dateLine ? (
              <p className="mt-1 text-sm text-muted-foreground">{dateLine}</p>
            ) : null}
            {taskbook.status === "denied" && taskbook.denial_reason ? (
              <p className="mt-1 text-sm text-muted-foreground">Denied: {taskbook.denial_reason}</p>
            ) : null}
            {taskbook.notes ? <p className="mt-2 text-sm">{taskbook.notes}</p> : null}
            {taskbook.file_name ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Completion document: {taskbook.file_name}
              </p>
            ) : null}
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          </div>
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
            completing ? null : (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => setCompleting(true)}
              >
                Mark complete
              </Button>
            )
          ) : null}
          {canDecide && taskbook.status === "completed" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => setEditingCompletion((open) => !open)}
            >
              {editingCompletion ? "Cancel" : "Edit completion"}
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
        prerequisites={prerequisites}
        checkedKeys={checkedKeys}
        canCheck={canCheckPrerequisites}
      />
      {canDecide && completing && taskbook.status === "active" ? (
        <div className="mt-4 border-t pt-4">
          <CompleteTaskbookForm
            taskbook={taskbook}
            onDone={() => {
              setCompleting(false);
              router.refresh();
            }}
            onCancel={() => setCompleting(false)}
          />
        </div>
      ) : null}
      {canDecide && editingCompletion && taskbook.status === "completed" ? (
        <div className="mt-4 border-t pt-4">
          <EditCompletionForm
            taskbook={taskbook}
            canEditDate={canIssue}
            onDone={() => {
              setEditingCompletion(false);
              router.refresh();
            }}
            onCancel={() => setEditingCompletion(false)}
          />
        </div>
      ) : null}
    </li>
  );
}

function TaskbookFilePreview({
  id,
  profileId,
  mimeType,
  fileName,
}: {
  id: string;
  profileId: string;
  mimeType: string | null;
  fileName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <CertificationFilePreview
      src={null}
      mimeType={mimeType}
      fileName={fileName}
      onOpen={() => {
        if (pending) return;
        startTransition(async () => {
          const { url } = await getPersonnelTaskbookDownloadUrl({ id, profileId });
          window.open(url, "_blank", "noopener,noreferrer");
        });
      }}
    />
  );
}

function TaskbookFileFields({
  idPrefix,
  selectedFile,
  setSelectedFile,
  existingFileName,
  removeFile,
  setRemoveFile,
  convertingHeic,
  setConvertingHeic,
  setError,
  pending,
}: {
  idPrefix: string;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  existingFileName?: string | null;
  removeFile?: boolean;
  setRemoveFile?: (value: boolean) => void;
  convertingHeic: boolean;
  setConvertingHeic: (value: boolean) => void;
  setError: (value: string | null) => void;
  pending: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedPreviewUrl = useObjectUrl(selectedFile);
  const showExisting = Boolean(existingFileName && !removeFile && !selectedFile);
  const previewSrc = selectedPreviewUrl;
  const previewMime = selectedFile?.type || null;
  const previewName = selectedFile?.name ?? (showExisting ? existingFileName ?? null : null);

  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={`${idPrefix}-file`}>
        {showExisting ? "Replace supporting document" : "Supporting document"}
      </FieldLabel>
      {previewSrc || previewName ? (
        <div className="flex flex-wrap items-center gap-3">
          <CertificationFilePreview
            src={previewSrc}
            mimeType={previewMime}
            fileName={previewName}
          />
          {showExisting && setRemoveFile ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="text-destructive"
              disabled={pending}
              onClick={() => {
                setRemoveFile(true);
                setSelectedFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Remove
            </Button>
          ) : selectedFile ? (
            <p className="text-sm text-muted-foreground">New file selected</p>
          ) : null}
        </div>
      ) : null}
      <input
        id={`${idPrefix}-file`}
        ref={fileRef}
        type="file"
        accept={PERSONNEL_DOCUMENT_ACCEPT}
        disabled={pending || convertingHeic}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        onChange={async (event) => {
          const file = event.target.files?.[0] ?? null;
          if (!file) {
            setSelectedFile(null);
            return;
          }
          setError(null);
          setConvertingHeic(true);
          try {
            const next = await fileAsJpegIfHeic(file);
            setSelectedFile(next);
            setRemoveFile?.(false);
          } catch {
            setSelectedFile(null);
            if (fileRef.current) fileRef.current.value = "";
            setError("Could not read this HEIC image. Try exporting it as a JPEG.");
          } finally {
            setConvertingHeic(false);
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        PDF, JPEG, PNG, WebP, HEIC, or Word. Optional proof of taskbook completion.
      </p>
    </div>
  );
}

function CompleteTaskbookForm({
  taskbook,
  onDone,
  onCancel,
}: {
  taskbook: PersonnelTaskbook;
  onDone: () => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [completedOn, setCompletedOn] = useState(today);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [convertingHeic, setConvertingHeic] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (selectedFile && !isPersonnelDocumentFile(selectedFile)) {
          setError("Unsupported file type. Use PDF, image, or Word document.");
          return;
        }
        setError(null);
        startTransition(async () => {
          try {
            const { storagePath, token } = await completePersonnelTaskbook({
              id: taskbook.id,
              profileId: taskbook.profile_id,
              completedOn,
              fileName: selectedFile?.name ?? null,
              mimeType: selectedFile?.type || null,
            });
            if (selectedFile && storagePath && token) {
              await uploadTaskbookFile(storagePath, token, selectedFile);
            }
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not complete taskbook");
          }
        });
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor={`complete-on-${taskbook.id}`}>Completed on</FieldLabel>
        <Input
          id={`complete-on-${taskbook.id}`}
          type="date"
          required
          value={completedOn}
          onChange={(e) => setCompletedOn(e.target.value)}
        />
      </div>
      <TaskbookFileFields
        idPrefix={`complete-${taskbook.id}`}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        convertingHeic={convertingHeic}
        setConvertingHeic={setConvertingHeic}
        setError={setError}
        pending={pending}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || convertingHeic || !completedOn}>
          {pending ? "Saving…" : convertingHeic ? "Preparing image…" : "Mark complete"}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EditCompletionForm({
  taskbook,
  canEditDate,
  onDone,
  onCancel,
}: {
  taskbook: PersonnelTaskbook;
  canEditDate: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [completedOn, setCompletedOn] = useState(taskbook.completed_on?.slice(0, 10) ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [convertingHeic, setConvertingHeic] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (selectedFile && !isPersonnelDocumentFile(selectedFile)) {
          setError("Unsupported file type. Use PDF, image, or Word document.");
          return;
        }
        setError(null);
        startTransition(async () => {
          try {
            const { storagePath, token } = await updatePersonnelTaskbookCompletion({
              id: taskbook.id,
              profileId: taskbook.profile_id,
              ...(canEditDate ? { completedOn } : {}),
              fileName: selectedFile?.name ?? null,
              mimeType: selectedFile?.type || null,
              removeFile: removeFile && !selectedFile,
            });
            if (selectedFile && storagePath && token) {
              await uploadTaskbookFile(storagePath, token, selectedFile);
            }
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update completion");
          }
        });
      }}
    >
      {canEditDate ? (
        <div className="space-y-2">
          <FieldLabel htmlFor={`edit-completed-on-${taskbook.id}`}>Completed on</FieldLabel>
          <Input
            id={`edit-completed-on-${taskbook.id}`}
            type="date"
            required
            value={completedOn}
            onChange={(e) => setCompletedOn(e.target.value)}
          />
        </div>
      ) : null}
      <TaskbookFileFields
        idPrefix={`edit-${taskbook.id}`}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        existingFileName={taskbook.file_name}
        removeFile={removeFile}
        setRemoveFile={setRemoveFile}
        convertingHeic={convertingHeic}
        setConvertingHeic={setConvertingHeic}
        setError={setError}
        pending={pending}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || convertingHeic || (canEditDate && !completedOn)}
        >
          {pending ? "Saving…" : convertingHeic ? "Preparing image…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
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
