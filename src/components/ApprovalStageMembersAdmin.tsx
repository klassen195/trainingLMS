"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  replaceApprovalCommitteeMembers,
  replaceApprovalStageMembers,
} from "@/app/approval-tracker/actions";
import { ApprovalPersonnelPicker } from "@/components/ApprovalPersonnelPicker";
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
import { personnelDisplayName, comparePersonnelByName } from "@/lib/personnel-types";

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
  const saveGeneration = useRef<Record<string, number>>({});
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
  const [, startTransition] = useTransition();

  function beginSave(key: string) {
    const generation = (saveGeneration.current[key] ?? 0) + 1;
    saveGeneration.current[key] = generation;
    setError(null);
    setPendingKey(key);
    return generation;
  }

  function finishSave(key: string, generation: number) {
    if (saveGeneration.current[key] !== generation) return false;
    setPendingKey((current) => (current === key ? null : current));
    return true;
  }

  function saveStage(slot: ApprovalAssignmentSlot, profileIds: string[]) {
    const generation = beginSave(slot.key);
    startTransition(async () => {
      try {
        await replaceApprovalStageMembers({
          stage: slot.stage,
          profileIds,
        });
        if (!finishSave(slot.key, generation)) return;
        router.refresh();
      } catch (err) {
        if (!finishSave(slot.key, generation)) return;
        setError(err instanceof Error ? err.message : "Failed to save stage members.");
      }
    });
  }

  function saveCommittee(
    slot: ApprovalCommitteeSlot,
    profileIds: string[],
    chairId: string
  ) {
    const generation = beginSave(slot.key);
    startTransition(async () => {
      try {
        await replaceApprovalCommitteeMembers({
          committee: slot.committee,
          subcommittee: slot.subcommittee,
          profileIds,
          chairId: chairId || null,
        });
        if (!finishSave(slot.key, generation)) return;
        router.refresh();
      } catch (err) {
        if (!finishSave(slot.key, generation)) return;
        setError(err instanceof Error ? err.message : "Failed to save committee members.");
      }
    });
  }

  function savingLabel(key: string) {
    return pendingKey === key ? (
      <span className="text-xs font-normal text-muted-foreground">Saving…</span>
    ) : null;
  }

  function stageCard(slot: ApprovalAssignmentSlot) {
    return (
      <Card key={slot.key}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-lg">
            <span>{slot.label}</span>
            {savingLabel(slot.key)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalPersonnelPicker
            profiles={profiles}
            selectedIds={selected[slot.key] ?? []}
            onChange={(ids) => {
              setSelected((current) => ({ ...current, [slot.key]: ids }));
              saveStage(slot, ids);
            }}
          />
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
        const chairOptions = profiles
          .filter((person) => memberIds.includes(person.id))
          .sort(comparePersonnelByName);
        return (
          <Card key={slot.key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-lg">
                <span>{slot.label}</span>
                {savingLabel(slot.key)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ApprovalPersonnelPicker
                profiles={profiles}
                selectedIds={memberIds}
                onChange={(ids) => {
                  const nextChair =
                    chairs[slot.key] && ids.includes(chairs[slot.key]) ? chairs[slot.key] : "";
                  setCommitteeSelected((current) => ({ ...current, [slot.key]: ids }));
                  setChairs((current) => ({ ...current, [slot.key]: nextChair }));
                  saveCommittee(slot, ids, nextChair);
                }}
              />
              <div className="space-y-1.5">
                <FieldLabel htmlFor={`chair-${slot.key}`}>Chair</FieldLabel>
                <Select
                  id={`chair-${slot.key}`}
                  value={chairs[slot.key] ?? ""}
                  onChange={(e) => {
                    const nextChair = e.target.value;
                    setChairs((current) => ({ ...current, [slot.key]: nextChair }));
                    saveCommittee(slot, memberIds, nextChair);
                  }}
                >
                  <option value="">No chair</option>
                  {chairOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {personnelDisplayName(person)}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {APPROVAL_ASSIGNMENT_SLOTS.filter((slot) => slot.stage !== "assistant_chief").map(stageCard)}
    </div>
  );
}
