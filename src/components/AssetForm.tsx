"use client";

import { useState, useTransition } from "react";
import { createAsset, updateAsset, type AssetFormInput } from "@/app/assets/actions";
import {
  type ApparatusType,
  type Asset,
  type AssetKind,
  type AssetStatus,
  type PpeCategory,
} from "@/lib/assets-types";
import type { Location } from "@/lib/locations-types";
import type { VehicleCheckTemplate } from "@/lib/vehicle-checks-types";
import {
  apparatusTypeLabel,
  apparatusTypes,
  assetStatusLabel,
  assetStatuses,
  ppeCategories,
  ppeCategoryLabel,
} from "@/lib/labels";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export type ProfileOption = {
  id: string;
  display_name: string | null;
  email: string | null;
};

function profileLabel(p: ProfileOption) {
  return p.display_name || p.email || p.id.slice(0, 8);
}

export function AssetForm({
  mode,
  kind,
  asset,
  profiles,
  locations,
  checkTemplates = [],
  assignedCheckTemplateIds = [],
}: {
  mode: "create" | "edit";
  kind: AssetKind;
  asset?: Asset;
  profiles: ProfileOption[];
  locations: Pick<Location, "id" | "name">[];
  checkTemplates?: Pick<
    VehicleCheckTemplate,
    "id" | "name" | "apparatus_type" | "is_type_default"
  >[];
  assignedCheckTemplateIds?: string[];
}) {
  const [name, setName] = useState(asset?.name ?? "");
  const [status, setStatus] = useState<AssetStatus>(asset?.status ?? "in_service");
  const [station, setStation] = useState(
    asset?.station ?? (kind === "ppe" ? (locations[0]?.name ?? "") : "")
  );
  const [manufacturer, setManufacturer] = useState(asset?.manufacturer ?? "");
  const [model, setModel] = useState(asset?.model ?? "");
  const [serialNumber, setSerialNumber] = useState(asset?.serial_number ?? "");
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [assignedTo, setAssignedTo] = useState(asset?.assigned_to ?? "");
  const [ppeCategory, setPpeCategory] = useState<PpeCategory>(asset?.ppe_category ?? "turnout_coat");
  const [size, setSize] = useState(asset?.size ?? "");
  const [manufacturedOn, setManufacturedOn] = useState(asset?.manufactured_on ?? "");
  const [expiresOn, setExpiresOn] = useState(asset?.expires_on ?? "");
  const [unitNumber, setUnitNumber] = useState(asset?.unit_number ?? "");
  const [apparatusType, setApparatusType] = useState<ApparatusType | "">(
    asset?.apparatus_type ?? ""
  );
  const [year, setYear] = useState(asset?.year?.toString() ?? "");
  const [buildNumber, setBuildNumber] = useState(asset?.build_number ?? "");
  const [vehicleCheckTemplateIds, setVehicleCheckTemplateIds] = useState<string[]>(
    assignedCheckTemplateIds
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function buildInput(): AssetFormInput {
    return {
      kind,
      name: kind === "ppe" ? name : undefined,
      status,
      station,
      manufacturer,
      model,
      serial_number: serialNumber,
      notes,
      assigned_to: assignedTo || null,
      ppe_category: kind === "ppe" ? ppeCategory : null,
      size,
      manufactured_on: manufacturedOn || null,
      expires_on: expiresOn || null,
      unit_number: unitNumber,
      apparatus_type: kind === "apparatus" && apparatusType ? apparatusType : null,
      year: year ? Number(year) : null,
      build_number: buildNumber,
      vehicle_check_template_ids: kind === "apparatus" ? vehicleCheckTemplateIds : [],
    };
  }

  function toggleTemplate(id: string) {
    setVehicleCheckTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            if (mode === "create") {
              await createAsset(buildInput());
            } else if (asset) {
              await updateAsset(asset.id, buildInput());
            }
          } catch (err) {
            if (
              err &&
              typeof err === "object" &&
              "digest" in err &&
              String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
            ) {
              throw err;
            }
            setError(err instanceof Error ? err.message : "Something went wrong.");
          }
        });
      }}
    >
      {kind === "ppe" ? (
        <div className="space-y-2">
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      ) : (
        <div className="space-y-2">
          <FieldLabel htmlFor="build_number">Build number</FieldLabel>
          <Input
            id="build_number"
            required
            value={buildNumber}
            onChange={(e) => setBuildNumber(e.target.value)}
            placeholder="e.g. 0V95"
          />
          <FieldHint>Required. This identifies the apparatus chassis.</FieldHint>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AssetStatus)}
          >
            {assetStatuses.map((s) => (
              <option key={s} value={s}>
                {assetStatusLabel(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="station">Location</FieldLabel>
          <Select
            id="station"
            value={station}
            required={kind === "ppe"}
            onChange={(e) => setStation(e.target.value)}
          >
            {kind === "apparatus" ? <option value="">Unassigned</option> : null}
            {locations.map((location) => (
              <option key={location.id} value={location.name}>
                {location.name}
              </option>
            ))}
            {station && !locations.some((location) => location.name === station) ? (
              <option value={station}>{station} (inactive)</option>
            ) : null}
          </Select>
        </div>
      </div>

      {kind === "ppe" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="ppe_category">PPE category</FieldLabel>
              <Select
                id="ppe_category"
                value={ppeCategory}
                onChange={(e) => setPpeCategory(e.target.value as PpeCategory)}
              >
                {ppeCategories.map((c) => (
                  <option key={c} value={c}>
                    {ppeCategoryLabel(c)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="size">Size</FieldLabel>
              <Input id="size" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="assigned_to">Assigned to</FieldLabel>
            <Select
              id="assigned_to"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {profileLabel(p)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="manufactured_on">Manufactured</FieldLabel>
              <Input
                id="manufactured_on"
                type="date"
                value={manufacturedOn}
                onChange={(e) => setManufacturedOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="expires_on">Expires</FieldLabel>
              <Input
                id="expires_on"
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <FieldLabel htmlFor="unit_number">Unit number</FieldLabel>
            <Input
              id="unit_number"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="e.g. E1"
            />
            <FieldHint>
              Optional call sign. Moving a unit here clears it from any other build and records
              assignment history.
            </FieldHint>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="apparatus_type">Apparatus type</FieldLabel>
              <Select
                id="apparatus_type"
                value={apparatusType}
                onChange={(e) => setApparatusType(e.target.value as ApparatusType | "")}
              >
                <option value="">Unspecified</option>
                {apparatusTypes.map((t) => (
                  <option key={t} value={t}>
                    {apparatusTypeLabel(t)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="year">Year</FieldLabel>
              <Input
                id="year"
                type="number"
                min={1900}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <FieldLabel>Checklist templates</FieldLabel>
            {checkTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {checkTemplates.map((template) => (
                  <label key={template.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={vehicleCheckTemplateIds.includes(template.id)}
                      onChange={() => toggleTemplate(template.id)}
                    />
                    <span>
                      {template.name}
                      {template.apparatus_type
                        ? ` (${apparatusTypeLabel(template.apparatus_type)})`
                        : ""}
                      {template.is_type_default ? " · type default" : ""}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Leave none selected to inherit all type-default templates for this apparatus type.
              Selecting any list replaces those defaults for this build only.
            </p>
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <FieldLabel htmlFor="manufacturer">Manufacturer</FieldLabel>
          <Input
            id="manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="model">Model</FieldLabel>
          <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="serial_number">Serial number</FieldLabel>
          <Input
            id="serial_number"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="notes">Notes</FieldLabel>
        <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      <Button type="submit" variant="primary" disabled={pending} className="bg-[#C11B2B] text-white">
        {pending ? "Saving..." : mode === "create" ? "Create asset" : "Save changes"}
      </Button>
    </form>
  );
}
