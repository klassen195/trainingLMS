"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replaceUpcomingTrainingOpsMembers } from "@/app/document-training/upcoming/actions";
import { ApprovalPersonnelPicker } from "@/components/ApprovalPersonnelPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError } from "@/components/ui/Field";
import type { ApprovalProfileOption } from "@/lib/approval-tracker-types";
import type { UpcomingTrainingOpsMember } from "@/lib/upcoming-training-types";

export function UpcomingTrainingOpsMembersAdmin({
  profiles,
  members,
}: {
  profiles: ApprovalProfileOption[];
  members: UpcomingTrainingOpsMember[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState(() => members.map((m) => m.profile_id));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(ids: string[]) {
    setSelectedIds(ids);
    setError(null);
    startTransition(async () => {
      try {
        await replaceUpcomingTrainingOpsMembers({ profileIds: ids });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save Ops Team members.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ops Team</CardTitle>
        <p className="text-sm text-muted-foreground">
          Members approve the final stage of training attendance requests.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ApprovalPersonnelPicker
          profiles={profiles}
          selectedIds={selectedIds}
          onChange={onChange}
          disabled={pending}
          emptyHint="Search to add Ops Team members."
        />
        {pending ? <p className="text-xs text-muted-foreground">Saving…</p> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </CardContent>
    </Card>
  );
}
