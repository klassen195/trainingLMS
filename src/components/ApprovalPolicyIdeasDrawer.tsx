"use client";

import { forwardRef, useState, useTransition, type ButtonHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Plus, Trash2, UserPlus } from "lucide-react";
import {
  assignApprovalPolicyIdea,
  createApprovalPolicyIdea,
  deleteApprovalPolicyIdea,
} from "@/app/approval-tracker/actions";
import { ApprovalPersonnelPicker } from "@/components/ApprovalPersonnelPicker";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import {
  APPROVAL_DOC_TYPES,
  APPROVAL_SUBMISSION_KINDS,
  approvalDocTypeLabel,
  approvalSubmissionKindLabel,
  type ApprovalDocType,
  type ApprovalPolicyIdea,
  type ApprovalProfileOption,
  type ApprovalSubmissionKind,
} from "@/lib/approval-tracker-types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { personnelDisplayName } from "@/lib/personnel-types";

export function ApprovalPolicyIdeasDrawer({
  ideas,
  profiles,
  currentUserId,
  isAdminUser,
}: {
  ideas: ApprovalPolicyIdea[];
  profiles: ApprovalProfileOption[];
  currentUserId: string;
  isAdminUser: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <PolicyIdeasTab
          count={ideas.length}
          aria-label={`Open policy ideas (${ideas.length})`}
          className="fixed left-0 z-40 transition-[padding] hover:pl-3"
        />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[calc(100%-2.75rem)] flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetClose asChild>
          <PolicyIdeasTab
            count={ideas.length}
            aria-label="Close policy ideas"
            className="absolute left-full"
          />
        </SheetClose>
        <SheetHeader className="border-b p-5 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Policy ideas
          </SheetTitle>
          <SheetDescription>
            Ideas waiting for someone to take them on. Assign one to put it on the board at the
            Document creator stage.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <NewIdeaForm />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Unassigned ({ideas.length})
            </h3>
            {ideas.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No policy ideas yet.
              </p>
            ) : (
              ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  profiles={profiles}
                  canRemove={isAdminUser || idea.created_by === currentUserId}
                  onAssigned={() => setOpen(false)}
                />
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const PolicyIdeasTab = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { count: number }
>(function PolicyIdeasTab({ count, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-r-lg border border-l-0 bg-primary px-2 py-4 text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      <Lightbulb className="h-4 w-4" />
      <span className="rotate-180 text-sm font-medium [writing-mode:vertical-rl]">
        Policy ideas
      </span>
      {count > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1 text-[11px] font-semibold text-primary">
          {count}
        </span>
      ) : null}
    </button>
  );
});

function NewIdeaForm() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<ApprovalDocType>("policy");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!expanded) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setExpanded(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add policy idea
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-md border bg-muted/30 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await createApprovalPolicyIdea({ title, docType, notes });
            setTitle("");
            setDocType("policy");
            setNotes("");
            setExpanded(false);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add idea.");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <FieldLabel htmlFor="policy-idea-title">Title</FieldLabel>
        <Input
          id="policy-idea-title"
          required
          autoFocus
          value={title}
          disabled={pending}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="policy-idea-type">Type</FieldLabel>
        <Select
          id="policy-idea-type"
          value={docType}
          disabled={pending}
          onChange={(e) => setDocType(e.target.value as ApprovalDocType)}
        >
          {APPROVAL_DOC_TYPES.map((type) => (
            <option key={type} value={type}>
              {approvalDocTypeLabel(type)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <FieldLabel htmlFor="policy-idea-notes">Notes</FieldLabel>
        <Textarea
          id="policy-idea-notes"
          rows={3}
          value={notes}
          disabled={pending}
          placeholder="Optional: what problem this would solve"
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add idea"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setExpanded(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function IdeaCard({
  idea,
  profiles,
  canRemove,
  onAssigned,
}: {
  idea: ApprovalPolicyIdea;
  profiles: ApprovalProfileOption[];
  canRemove: boolean;
  onAssigned: () => void;
}) {
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [submissionKind, setSubmissionKind] = useState<ApprovalSubmissionKind>("new");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-md border bg-background p-3 shadow-sm">
      <div className="mb-1.5 flex flex-wrap items-start gap-1.5">
        <Badge variant="secondary">{approvalDocTypeLabel(idea.doc_type)}</Badge>
      </div>
      <p className="text-sm font-medium leading-snug">{idea.title}</p>
      {idea.notes ? (
        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{idea.notes}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Added by{" "}
        {personnelDisplayName(idea.creator ?? { display_name: null, email: null })} ·{" "}
        {formatDate(idea.created_at)}
      </p>

      {assigning ? (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <FieldLabel>Assign to</FieldLabel>
            <ApprovalPersonnelPicker
              profiles={profiles}
              selectedIds={assignedTo ? [assignedTo] : []}
              onChange={(ids) => setAssignedTo(ids[0] ?? "")}
              single
              disabled={pending}
              emptyHint="Choose the person who will take on this policy."
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`idea-kind-${idea.id}`}>Document status</FieldLabel>
            <Select
              id={`idea-kind-${idea.id}`}
              value={submissionKind}
              disabled={pending}
              onChange={(e) => setSubmissionKind(e.target.value as ApprovalSubmissionKind)}
            >
              {APPROVAL_SUBMISSION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {approvalSubmissionKindLabel(kind)}
                </option>
              ))}
            </Select>
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || !assignedTo}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    const created = await assignApprovalPolicyIdea({
                      id: idea.id,
                      assignedTo,
                      submissionKind,
                    });
                    onAssigned();
                    router.push(`/approval-tracker/${created.id}`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to assign idea.");
                  }
                });
              }}
            >
              {pending ? "Assigning…" : "Assign and add to board"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setAssigning(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {error ? <FieldError className="mt-2">{error}</FieldError> : null}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAssigning(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Assign
            </Button>
            {canRemove ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Remove "${idea.title}" from policy ideas?`)) return;
                  setError(null);
                  startTransition(async () => {
                    try {
                      await deleteApprovalPolicyIdea({ id: idea.id });
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to remove idea.");
                    }
                  });
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
