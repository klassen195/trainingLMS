import Link from "next/link";
import { ApprovalPathDots } from "@/components/ApprovalPathStepper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  APPROVAL_COMMITTEES,
  APPROVAL_STAGES,
  approvalBoardHref,
  approvalCommitteeBodyLabel,
  approvalCommitteeLabel,
  approvalDocTypeLabel,
  approvalStageLabel,
  approvalSubmissionKindLabel,
  daysInApprovalStageLabel,
  isWaitingOnApprovalUser,
  type ApprovalCommittee,
  type ApprovalCommitteeMember,
  type ApprovalCommitteeVote,
  type ApprovalDocumentListItem,
  type ApprovalStageMemberIndex,
} from "@/lib/approval-tracker-types";
import { personnelDisplayName } from "@/lib/personnel-types";
import { cn } from "@/lib/cn";

export function ApprovalTrackerBoard({
  documents,
  currentUserId,
  stageMemberIds,
  committeeMembers,
  votes,
  showArchived,
  committeeFilter,
}: {
  documents: ApprovalDocumentListItem[];
  currentUserId: string;
  stageMemberIds: ApprovalStageMemberIndex;
  committeeMembers: ApprovalCommitteeMember[];
  votes: ApprovalCommitteeVote[];
  showArchived: boolean;
  committeeFilter: ApprovalCommittee | "all";
}) {
  const votesByDoc = new Map<string, string[]>();
  for (const vote of votes) {
    const list = votesByDoc.get(vote.document_id) ?? [];
    list.push(vote.profile_id);
    votesByDoc.set(vote.document_id, list);
  }

  const visible = documents.filter((doc) => {
    if (showArchived ? !doc.archived_at : doc.archived_at) return false;
    if (committeeFilter !== "all" && doc.committee !== committeeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-md border p-1">
          {(["all", ...APPROVAL_COMMITTEES] as const).map((value) => {
            const href = approvalBoardHref({
              committee: value,
              archived: showArchived,
            });
            const active = committeeFilter === value;
            return (
              <Button key={value} asChild size="sm" variant={active ? "default" : "ghost"}>
                <Link href={href}>{value === "all" ? "All" : approvalCommitteeLabel(value)}</Link>
              </Button>
            );
          })}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link
            href={approvalBoardHref({
              committee: committeeFilter,
              archived: !showArchived,
            })}
          >
            {showArchived ? "Show active board" : "Show archived"}
          </Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {visible.length === 0
          ? showArchived
            ? "No archived documents."
            : "No documents on the board yet."
          : `${visible.length} document${visible.length === 1 ? "" : "s"}`}
      </p>

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-[132rem] gap-3">
          {APPROVAL_STAGES.map((stage) => {
            const columnDocs = visible.filter((doc) => doc.current_stage === stage);
            return (
              <section
                key={stage}
                className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30"
              >
                <header className="border-b px-3 py-2">
                  <h2 className="text-sm font-semibold">{approvalStageLabel(stage)}</h2>
                  <p className="text-xs text-muted-foreground">
                    {columnDocs.length} {columnDocs.length === 1 ? "item" : "items"}
                  </p>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {columnDocs.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">None</p>
                  ) : (
                    columnDocs.map((doc) => {
                      const waitingOnYou = isWaitingOnApprovalUser({
                        userId: currentUserId,
                        stage: doc.current_stage,
                        createdBy: doc.created_by,
                        stageMemberIds,
                        committee: doc.committee,
                        subcommittee: doc.subcommittee,
                        committeeMembers,
                        votedProfileIds: votesByDoc.get(doc.id) ?? [],
                      });
                      return (
                        <Link
                          key={doc.id}
                          href={`/approval-tracker/${doc.id}`}
                          className={cn(
                            "rounded-md border bg-background p-3 shadow-sm transition-colors hover:border-primary/50",
                            waitingOnYou && "border-primary ring-2 ring-primary/20"
                          )}
                        >
                          <div className="mb-2 flex flex-wrap items-start gap-1.5">
                            {doc.committee ? (
                              <Badge variant="outline">
                                {approvalCommitteeBodyLabel(doc.committee, doc.subcommittee)}
                              </Badge>
                            ) : null}
                            <Badge variant="outline">
                              {approvalSubmissionKindLabel(doc.submission_kind)}
                            </Badge>
                            <Badge variant="secondary">{approvalDocTypeLabel(doc.doc_type)}</Badge>
                            {waitingOnYou ? (
                              <span className="ml-auto text-[11px] font-medium text-primary">
                                Your stage
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm font-medium leading-snug">{doc.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {personnelDisplayName(doc.creator ?? { display_name: null, email: null })}
                          </p>
                          <ApprovalPathDots currentStage={doc.current_stage} className="mt-3" />
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {daysInApprovalStageLabel(doc.stage_entered_at)} in stage
                            {doc.archived_at ? " · Archived" : ""}
                          </p>
                        </Link>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
