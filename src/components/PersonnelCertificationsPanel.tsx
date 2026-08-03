"use client";

import { useState, useTransition } from "react";
import {
  createPersonnelCertification,
  deletePersonnelCertification,
  updatePersonnelCertification,
} from "@/app/personnel/actions";
import type { PersonnelCertification } from "@/lib/personnel-types";
import { isCertExpired } from "@/lib/personnel-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

function formatDate(value: string | null) {
  if (!value) return "—";
  return value.slice(0, 10);
}

export function PersonnelCertificationsPanel({
  profileId,
  certifications,
  canManage,
}: {
  profileId: string;
  certifications: PersonnelCertification[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {certifications.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No certifications recorded.</p>
      ) : (
        <ul className="space-y-3">
          {certifications.map((cert) =>
            editingId === cert.id ? (
              <li key={cert.id} className="rounded-lg border p-4">
                <CertificationForm
                  profileId={profileId}
                  initial={cert}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={cert.id}
                className={cn(
                  "rounded-lg border p-4",
                  isCertExpired(cert.expires_on) && "border-destructive/50 bg-destructive/5"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{cert.name}</p>
                    {cert.issuing_authority ? (
                      <p className="text-sm text-muted-foreground">{cert.issuing_authority}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted-foreground">
                      Issued {formatDate(cert.issued_on)} · Expires {formatDate(cert.expires_on)}
                      {isCertExpired(cert.expires_on) ? (
                        <span className="ml-2 font-medium text-destructive">Expired</span>
                      ) : null}
                    </p>
                    {cert.notes ? <p className="mt-2 text-sm">{cert.notes}</p> : null}
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEditingId(cert.id)}>
                        Edit
                      </Button>
                      <DeleteCertButton id={cert.id} profileId={profileId} />
                    </div>
                  ) : null}
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {canManage ? (
        adding ? (
          <div className="rounded-lg border p-4">
            <CertificationForm
              profileId={profileId}
              onDone={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add certification
          </Button>
        )
      ) : null}
    </div>
  );
}

function DeleteCertButton({ id, profileId }: { id: string; profileId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="text-destructive"
      onClick={() => {
        if (!confirm("Delete this certification?")) return;
        startTransition(async () => {
          await deletePersonnelCertification({ id, profileId });
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

function CertificationForm({
  profileId,
  initial,
  onDone,
  onCancel,
}: {
  profileId: string;
  initial?: PersonnelCertification;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [issuingAuthority, setIssuingAuthority] = useState(initial?.issuing_authority ?? "");
  const [issuedOn, setIssuedOn] = useState(initial?.issued_on ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expires_on ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
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
            if (initial) {
              await updatePersonnelCertification({
                id: initial.id,
                profileId,
                name,
                issuingAuthority,
                issuedOn,
                expiresOn,
                notes,
              });
            } else {
              await createPersonnelCertification({
                profileId,
                name,
                issuingAuthority,
                issuedOn,
                expiresOn,
                notes,
              });
            }
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
          }
        });
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="cert-name">Name</FieldLabel>
        <Input id="cert-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <FieldLabel htmlFor="cert-issuer">Issuing authority</FieldLabel>
          <Input
            id="cert-issuer"
            value={issuingAuthority}
            onChange={(e) => setIssuingAuthority(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="cert-issued">Issued</FieldLabel>
          <Input
            id="cert-issued"
            type="date"
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="cert-expires">Expires</FieldLabel>
          <Input
            id="cert-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="cert-notes">Notes</FieldLabel>
        <Textarea id="cert-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
