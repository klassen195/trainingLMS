import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import {
  getApprovalDocument,
  listApprovalCommitteeMembers,
  listApprovalCommitteeVotes,
  listApprovalStageMembers,
} from "@/app/approval-tracker/actions";
import { ApprovalDocumentActions } from "@/components/ApprovalDocumentActions";
import { ApprovalDocumentDownloadButton } from "@/components/ApprovalDocumentDownloadButton";
import { ApprovalDocumentForm } from "@/components/ApprovalDocumentForm";
import { ApprovalPathStepper } from "@/components/ApprovalPathStepper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  approvalCommitteeBodyLabel,
  approvalDocTypeLabel,
  approvalEventActionLabel,
  approvalStageLabel,
  approvalSubmissionKindLabel,
  groupStageMemberIds,
  isApprovalStageActor,
  membersForCommitteeBody,
} from "@/lib/approval-tracker-types";
import { personnelDisplayName } from "@/lib/personnel-types";
import { formatDateTime } from "@/lib/dates";
import { isAdmin } from "@/lib/permissions";

export default async function ApprovalDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireCapability("approval_tracker");
  const { id } = await params;
  const [document, members, committeeMembers, votes] = await Promise.all([
    getApprovalDocument(id),
    listApprovalStageMembers(),
    listApprovalCommitteeMembers(),
    listApprovalCommitteeVotes([id]),
  ]);
  if (!document) notFound();

  const adminUser = isAdmin(profile);
  const canAct = isApprovalStageActor({
    userId: profile.id,
    isAdmin: adminUser,
    stage: document.current_stage,
    createdBy: document.created_by,
    stageMemberIds: groupStageMemberIds(members),
    committee: document.committee,
    subcommittee: document.subcommittee,
    committeeMembers,
  });
  const policyHolders = members.filter((member) => member.stage === "policy_holder");
  const bodyMembers = membersForCommitteeBody(
    committeeMembers,
    document.committee,
    document.subcommittee
  );
  const votedIds = new Set(votes.map((vote) => vote.profile_id));
  const currentMember = bodyMembers.find((member) => member.profile_id === profile.id);
  const canVote = document.current_stage === "committee" && Boolean(currentMember);
  const hasVoted = Boolean(currentMember && votedIds.has(profile.id));
  const canSendAsChair =
    document.current_stage === "committee" && (adminUser || Boolean(currentMember?.is_chair));
  const chair = bodyMembers.find((member) => member.is_chair);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/approval-tracker">Back to board</Link>
        </Button>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ListChecks className="h-7 w-7 text-primary" />
          {document.committee ? (
            <Badge variant="outline">
              {approvalCommitteeBodyLabel(document.committee, document.subcommittee)}
            </Badge>
          ) : (
            <Badge variant="outline">Committee unassigned</Badge>
          )}
          <Badge variant="outline">{approvalSubmissionKindLabel(document.submission_kind)}</Badge>
          <Badge variant="secondary">{approvalDocTypeLabel(document.doc_type)}</Badge>
          <Badge variant="outline">{approvalStageLabel(document.current_stage)}</Badge>
          {document.archived_at ? <Badge variant="outline">Archived</Badge> : null}
        </div>
        <h1 className="text-3xl font-bold">{document.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Started by {personnelDisplayName(document.creator ?? { display_name: null, email: null })}
        </p>
      </div>

      <div className="mb-8">
        <ApprovalPathStepper currentStage={document.current_stage} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attached file</CardTitle>
            </CardHeader>
            <CardContent>
              {document.file_name && document.storage_path ? (
                <ApprovalDocumentDownloadButton
                  documentId={document.id}
                  fileName={document.file_name}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No file attached yet. Upload one when editing this document.
                </p>
              )}
            </CardContent>
          </Card>

          {document.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{document.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Committee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                {approvalCommitteeBodyLabel(document.committee, document.subcommittee)}
                {chair
                  ? ` · Chair: ${personnelDisplayName(chair.profile ?? { display_name: null, email: null })}`
                  : ""}
              </p>
              {bodyMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No committee members assigned yet. An admin can set this under Policy Tracker.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {bodyMembers.map((member) => {
                    const approved = votedIds.has(member.profile_id);
                    return (
                      <li key={member.profile_id} className="flex items-center justify-between gap-2">
                        <span>
                          {personnelDisplayName(
                            member.profile ?? { display_name: null, email: null }
                          )}
                          {member.is_chair ? " (chair)" : ""}
                        </span>
                        {document.current_stage === "committee" ? (
                          <span className="text-xs text-muted-foreground">
                            {approved ? "Approved" : "Pending"}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Policy holder group</CardTitle>
            </CardHeader>
            <CardContent>
              {policyHolders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No policy holder group assigned yet. An admin can set this under Policy Tracker.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {policyHolders.map((member) => (
                    <li key={member.profile_id}>
                      {personnelDisplayName(
                        member.profile ?? { display_name: null, email: null }
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">History</CardTitle>
            </CardHeader>
            <CardContent>
              {document.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <ol className="space-y-4">
                  {document.events.map((event) => (
                    <li key={event.id} className="border-l-2 border-border pl-3">
                      <p className="text-sm font-medium">
                        {approvalEventActionLabel(event.action)}
                        {event.from_stage && event.to_stage && event.from_stage !== event.to_stage
                          ? ` · ${approvalStageLabel(event.from_stage)} → ${approvalStageLabel(event.to_stage)}`
                          : event.to_stage
                            ? ` · ${approvalStageLabel(event.to_stage)}`
                            : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {personnelDisplayName(event.actor ?? { display_name: null, email: null })} ·{" "}
                        {formatDateTime(event.created_at)}
                      </p>
                      {event.comment ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm">{event.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-4 text-xl font-semibold">Edit details</h2>
            <ApprovalDocumentForm
              initial={{
                id: document.id,
                title: document.title,
                docType: document.doc_type,
                submissionKind: document.submission_kind,
                notes: document.notes ?? "",
                fileName: document.file_name,
              }}
            />
          </div>
        </div>

        <div>
          <ApprovalDocumentActions
            documentId={document.id}
            currentStage={document.current_stage}
            archived={Boolean(document.archived_at)}
            canAct={canAct}
            committee={document.committee}
            subcommittee={document.subcommittee}
            canVote={canVote}
            hasVoted={hasVoted}
            canSendAsChair={canSendAsChair}
          />
        </div>
      </div>
    </div>
  );
}
