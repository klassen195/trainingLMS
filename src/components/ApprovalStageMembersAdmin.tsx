"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replaceApprovalStageMembers } from "@/app/approval-tracker/actions";
import { ApprovalPersonnelPicker } from "@/components/ApprovalPersonnelPicker";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError } from "@/components/ui/Field";
import {
  APPROVAL_ASSIGNMENT_SLOTS,
  type ApprovalAssignmentSlot,
  type ApprovalProfileOption,
  type ApprovalStageMember,
} from "@/lib/approval-tracker-types";

function slotKey(stage: string, track: string | null | undefined) {
  return track ? `${stage}:${track}` : stage;
}

export function ApprovalStageMembersAdmin({
  profiles,
  members,
}: {
  profiles: ApprovalProfileOption[];
  members: ApprovalStageMember[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = Object.fromEntries(
      APPROVAL_ASSIGNMENT_SLOTS.map((slot) => [slot.key, [] as string[]])
    );
    for (const member of members) {
      const key = slotKey(member.stage, member.track);
      if (!initial[key]) initial[key] = [];
      initial[key].push(member.profile_id);
    }
    return initial;
  });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(slot: ApprovalAssignmentSlot) {
    setError(null);
    setPendingKey(slot.key);
    startTransition(async () => {
      try {
        await replaceApprovalStageMembers({
          stage: slot.stage,
          track: slot.track,
          profileIds: selected[slot.key] ?? [],
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save stage members.");
      } finally {
        setPendingKey(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {error ? <FieldError>{error}</FieldError> : null}
      {APPROVAL_ASSIGNMENT_SLOTS.map((slot) => (
        <Card key={slot.key}>
          <CardHeader>
            <CardTitle className="text-lg">{slot.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApprovalPersonnelPicker
              profiles={profiles}
              selectedIds={selected[slot.key] ?? []}
              onChange={(ids) => setSelected((current) => ({ ...current, [slot.key]: ids }))}
              disabled={pending}
            />
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => save(slot)}
            >
              {pending && pendingKey === slot.key ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
