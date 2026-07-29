"use client";

import { useState, useTransition } from "react";
import {
  createVehicleCheckTemplate,
  deleteVehicleCheckTemplate,
  updateVehicleCheckTemplate,
} from "@/app/assets/vehicle-check-actions";
import type { ApparatusType } from "@/lib/assets-types";
import type { VehicleCheckTemplate } from "@/lib/vehicle-checks-types";
import { apparatusTypeLabel, apparatusTypes } from "@/lib/labels";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function CreateVehicleCheckTemplateForm() {
  const [name, setName] = useState("");
  const [apparatusType, setApparatusType] = useState<"" | ApparatusType>("");
  const [isTypeDefault, setIsTypeDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await createVehicleCheckTemplate({
              name,
              apparatusType: apparatusType || null,
              isTypeDefault,
            });
          } catch (err) {
            if (
              err &&
              typeof err === "object" &&
              "digest" in err &&
              String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
            ) {
              throw err;
            }
            setError(err instanceof Error ? err.message : "Failed to create template");
          }
        });
      }}
    >
      <p className="text-sm font-medium">New template</p>
      <div className="space-y-2">
        <FieldLabel htmlFor="new-template-name">Name</FieldLabel>
        <Input
          id="new-template-name"
          required
          value={name}
          disabled={pending}
          placeholder="e.g. Engine checklist"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="new-template-type">Apparatus type</FieldLabel>
        <Select
          id="new-template-type"
          value={apparatusType}
          disabled={pending}
          onChange={(e) => {
            const value = e.target.value as "" | ApparatusType;
            setApparatusType(value);
            if (!value) setIsTypeDefault(false);
          }}
        >
          <option value="">Any / untyped</option>
          {apparatusTypes.map((type) => (
            <option key={type} value={type}>
              {apparatusTypeLabel(type)}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isTypeDefault}
          disabled={pending || !apparatusType}
          onChange={(e) => setIsTypeDefault(e.target.checked)}
        />
        Set as type default
      </label>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={pending || !name.trim()}>
        {pending ? "Creating..." : "Create template"}
      </Button>
    </form>
  );
}

export function VehicleCheckTemplateSettings({
  template,
}: {
  template: VehicleCheckTemplate;
}) {
  const [name, setName] = useState(template.name);
  const [apparatusType, setApparatusType] = useState<"" | ApparatusType>(
    template.apparatus_type ?? ""
  );
  const [isTypeDefault, setIsTypeDefault] = useState(template.is_type_default);
  const [notes, setNotes] = useState(template.notes);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              await updateVehicleCheckTemplate({
                id: template.id,
                name,
                apparatusType: apparatusType || null,
                isTypeDefault,
                notes,
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to save template");
            }
          });
        }}
      >
        <p className="text-sm font-medium">Template settings</p>
        <div className="space-y-2">
          <FieldLabel htmlFor="template-name">Name</FieldLabel>
          <Input
            id="template-name"
            required
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="template-type">Apparatus type</FieldLabel>
          <Select
            id="template-type"
            value={apparatusType}
            disabled={pending}
            onChange={(e) => {
              const value = e.target.value as "" | ApparatusType;
              setApparatusType(value);
              if (!value) setIsTypeDefault(false);
            }}
          >
            <option value="">Any / untyped</option>
            {apparatusTypes.map((type) => (
              <option key={type} value={type}>
                {apparatusTypeLabel(type)}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isTypeDefault}
            disabled={pending || !apparatusType}
            onChange={(e) => setIsTypeDefault(e.target.checked)}
          />
          Set as type default
        </label>
        <div className="space-y-2">
          <FieldLabel htmlFor="template-notes">Notes</FieldLabel>
          <Textarea
            id="template-notes"
            rows={2}
            value={notes}
            disabled={pending}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button type="submit" size="sm" disabled={pending || !name.trim()}>
          {pending ? "Saving..." : "Save settings"}
        </Button>
      </form>

      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete template “${template.name}”?`)) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteVehicleCheckTemplate(template.id);
            } catch (err) {
              if (
                err &&
                typeof err === "object" &&
                "digest" in err &&
                String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
              ) {
                throw err;
              }
              setError(err instanceof Error ? err.message : "Failed to delete template");
            }
          });
        }}
      >
        Delete template
      </Button>
    </div>
  );
}
