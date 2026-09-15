"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProfessionalServicePractitioner,
  updateProfessionalServicePractitioner,
  type ProfessionalServicePractitionerInput,
} from "@/app/professional-services/actions";
import type { ProfessionalServicePractitioner } from "@/lib/professional-services-types";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";

export function ProfessionalServicePractitionerForm({
  providerId,
  practitioner,
  onDone,
}: {
  providerId: string;
  practitioner?: ProfessionalServicePractitioner | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(practitioner?.name ?? "");
  const [roleTitle, setRoleTitle] = useState(practitioner?.role_title ?? "");
  const [notes, setNotes] = useState(practitioner?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload: ProfessionalServicePractitionerInput = {
      providerId,
      name,
      roleTitle,
      notes,
    };
    try {
      if (practitioner) {
        await updateProfessionalServicePractitioner({ ...payload, id: practitioner.id });
      } else {
        await createProfessionalServicePractitioner(payload);
      }
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save person");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-person-name">Name</FieldLabel>
        <Input
          id="ps-person-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jordan Lee"
        />
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-person-role">Role / title</FieldLabel>
        <Input
          id="ps-person-role"
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          placeholder="Massage therapist"
        />
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="ps-person-notes">Notes</FieldLabel>
        <Textarea
          id="ps-person-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Works evenings, sports massage…"
          rows={3}
        />
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : practitioner ? "Save changes" : "Add person"}
        </Button>
      </div>
    </form>
  );
}
