import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import {
  getApprovalDocument,
  listApprovalStageMembers,
} from "@/app/approval-tracker/actions";
import { ApprovalDocumentActions } from "@/components/ApprovalDocumentActions";
import { ApprovalDocumentForm } from "@/components/ApprovalDocumentForm";
import { ApprovalPathStepper } from "@/components/ApprovalPathStepper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  approvalDocTypeLabel,
  approvalEventActionLabel,
  approvalStageLabel,
  approvalTrackLabel,
  groupStageMemberIds,
  isApprovalStageActor,
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
  const [document, members] = await Promise.all([
    getApprovalDocument(id),
    listApprovalStageMembers(),
  ]);
  if (!document) notFound();

  const canAct = isApprovalStageActor({
    userId: profile.id,
    isAdmin: isAdmin(profile),
    stage: document.current_stage,
    track: document.track,
    createdBy: document.created_by,
    stageMemberIds: groupStageMemberIds(members),
  });
  const policyHolders = members.filter((member) => member.stage === "policy_holder");

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
          <Badge variant="outline">{approvalTrackLabel(document.track)}</Badge>
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
                track: document.track,
                notes: document.notes ?? "",
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
          />
        </div>
      </div>
    </div>
  );
}
