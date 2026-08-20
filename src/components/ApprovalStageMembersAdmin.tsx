"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  replaceApprovalCommitteeMembers,
  replaceApprovalStageMembers,
} from "@/app/approval-tracker/actions";
import { ApprovalPersonnelPicker } from "@/components/ApprovalPersonnelPicker";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Select } from "@/components/ui/Input";
import {
  APPROVAL_ASSIGNMENT_SLOTS,
  APPROVAL_COMMITTEE_SLOTS,
  committeeSlotKey,
  type ApprovalAssignmentSlot,
  type ApprovalCommitteeMember,
  type ApprovalCommitteeSlot,
  type ApprovalProfileOption,
  type ApprovalStageMember,
} from "@/lib/approval-tracker-types";
import { personnelDisplayName } from "@/lib/personnel-types";

export function ApprovalStageMembersAdmin({
  profiles,
  members,
  committeeMembers,
}: {
  profiles: ApprovalProfileOption[];
  members: ApprovalStageMember[];
  committeeMembers: ApprovalCommitteeMember[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = Object.fromEntries(
      APPROVAL_ASSIGNMENT_SLOTS.map((slot) => [slot.key, [] as string[]])
    );
    for (const member of members) {
      if (!initial[member.stage]) initial[member.stage] = [];
      initial[member.stage].push(member.profile_id);
    }
    return initial;
  });
  const [committeeSelected, setCommitteeSelected] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = Object.fromEntries(
      APPROVAL_COMMITTEE_SLOTS.map((slot) => [slot.key, [] as string[]])
    );
    for (const member of committeeMembers) {
      const key = committeeSlotKey(member.committee, member.subcommittee);
      if (!initial[key]) initial[key] = [];
      initial[key].push(member.profile_id);
    }
    return initial;
  });
  const [chairs, setChairs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = Object.fromEntries(
      APPROVAL_COMMITTEE_SLOTS.map((slot) => [slot.key, ""])
    );
    for (const member of committeeMembers) {
      if (!member.is_chair) continue;
      initial[committeeSlotKey(member.committee, member.subcommittee)] = member.profile_id;
    }
    return initial;
  });
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveStage(slot: ApprovalAssignmentSlot) {
    setError(null);
    setPendingKey(slot.key);
    startTransition(async () => {
      try {
        await replaceApprovalStageMembers({
          stage: slot.stage,
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

  function saveCommittee(slot: ApprovalCommitteeSlot) {
    setError(null);
    setPendingKey(slot.key);
    startTransition(async () => {
      try {
        await replaceApprovalCommitteeMembers({
          committee: slot.committee,
          subcommittee: slot.subcommittee,
          profileIds: committeeSelected[slot.key] ?? [],
          chairId: chairs[slot.key] || null,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save committee members.");
      } finally {
        setPendingKey(null);
      }
    });
  }

  function stageCard(slot: ApprovalAssignmentSlot) {
    return (
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
          <Button type="button" size="sm" disabled={pending} onClick={() => saveStage(slot)}>
            {pending && pendingKey === slot.key ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <FieldError>{error}</FieldError> : null}

      {APPROVAL_ASSIGNMENT_SLOTS.filter((slot) => slot.stage === "assistant_chief").map(stageCard)}

      {APPROVAL_COMMITTEE_SLOTS.map((slot) => {
        const memberIds = committeeSelected[slot.key] ?? [];
        const chairOptions = profiles.filter((person) => memberIds.includes(person.id));
        return (
          <Card key={slot.key}>
            <CardHeader>
              <CardTitle className="text-lg">{slot.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ApprovalPersonnelPicker
                profiles={profiles}
                selectedIds={memberIds}
                onChange={(ids) => {
                  setCommitteeSelected((current) => ({ ...current, [slot.key]: ids }));
                  setChairs((current) =>
                    current[slot.key] && ids.includes(current[slot.key])
                      ? current
                      : { ...current, [slot.key]: "" }
                  );
                }}
                disabled={pending}
              />
              <div className="space-y-1.5">
                <FieldLabel htmlFor={`chair-${slot.key}`}>Chair</FieldLabel>
                <Select
                  id={`chair-${slot.key}`}
                  value={chairs[slot.key] ?? ""}
                  disabled={pending}
                  onChange={(e) =>
                    setChairs((current) => ({ ...current, [slot.key]: e.target.value }))
                  }
                >
                  <option value="">No chair</option>
                  {chairOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {personnelDisplayName(person)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => saveCommittee(slot)}
              >
                {pending && pendingKey === slot.key ? "Saving…" : "Save"}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {APPROVAL_ASSIGNMENT_SLOTS.filter((slot) => slot.stage !== "assistant_chief").map(stageCard)}
    </div>
  );
}
