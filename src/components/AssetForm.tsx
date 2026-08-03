"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createAsset, updateAsset, type AssetFormInput } from "@/app/assets/actions";
import {
  apparatusOptionLabel,
  type ApparatusType,
  type Asset,
  type AssetKind,
  type AssetStatus,
  type EquipmentAssignmentType,
} from "@/lib/assets-types";
import type { EquipmentCategory } from "@/lib/equipment-categories-types";
import type { EquipmentSubcategory } from "@/lib/equipment-subcategories-types";
import type { Location } from "@/lib/locations-types";
import type { VehicleCheckTemplate } from "@/lib/vehicle-checks-types";
import {
  apparatusTypeLabel,
  apparatusTypes,
  assetStatusLabel,
  assetStatuses,
} from "@/lib/labels";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export type ProfileOption = {
  id: string;
  display_name: string | null;
  email: string | null;
};

export type ApparatusOption = {
  id: string;
  name: string | null;
  unit_number: string | null;
  build_number: string | null;
};

function profileLabel(p: ProfileOption) {
  return p.display_name || p.email || p.id.slice(0, 8);
}

function initialAssignmentType(asset?: Asset): EquipmentAssignmentType | "" {
  if (asset?.assignment_type) return asset.assignment_type;
  if (asset?.assigned_to) return "person";
  return "";
}

export function AssetForm({
  mode,
  kind,
  asset,
  profiles,
  locations,
  apparatusOptions = [],
  equipmentCategories = [],
  equipmentSubcategories = [],
  checkTemplates = [],
  assignedCheckTemplateIds = [],
}: {
  mode: "create" | "edit";
  kind: AssetKind;
  asset?: Asset;
  profiles: ProfileOption[];
  locations: Pick<Location, "id" | "name">[];
  apparatusOptions?: ApparatusOption[];
  equipmentCategories?: Pick<EquipmentCategory, "id" | "name" | "is_active">[];
  equipmentSubcategories?: Pick<
    EquipmentSubcategory,
    "id" | "name" | "is_active" | "equipment_category_id"
  >[];
  checkTemplates?: Pick<
    VehicleCheckTemplate,
    "id" | "name" | "apparatus_type" | "is_type_default"
  >[];
  assignedCheckTemplateIds?: string[];
}) {
  const [name, setName] = useState(asset?.name ?? "");
  const [status, setStatus] = useState<AssetStatus>(asset?.status ?? "in_service");
  const [station, setStation] = useState(asset?.station ?? "");
  const [manufacturer, setManufacturer] = useState(asset?.manufacturer ?? "");
  const [model, setModel] = useState(asset?.model ?? "");
  const [serialNumber, setSerialNumber] = useState(asset?.serial_number ?? "");
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [assignmentType, setAssignmentType] = useState<EquipmentAssignmentType | "">(
    initialAssignmentType(asset)
  );
  const [assignedTo, setAssignedTo] = useState(asset?.assigned_to ?? "");
  const [assignedStation, setAssignedStation] = useState(asset?.assigned_station ?? "");
  const [assignedApparatusId, setAssignedApparatusId] = useState(
    asset?.assigned_apparatus_id ?? ""
  );
  const [equipmentCategoryId, setEquipmentCategoryId] = useState(
    asset?.equipment_category_id ?? equipmentCategories.find((c) => c.is_active)?.id ?? ""
  );
  const [equipmentSubcategoryId, setEquipmentSubcategoryId] = useState(
    asset?.equipment_subcategory_id ?? ""
  );
  const [description, setDescription] = useState(asset?.description ?? "");
  const [purchaseCost, setPurchaseCost] = useState(
    asset?.purchase_cost != null ? String(asset.purchase_cost) : ""
  );
  const [inServiceOn, setInServiceOn] = useState(asset?.in_service_on ?? "");
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

  const categoryOptions = equipmentCategories.filter(
    (c) => c.is_active || c.id === equipmentCategoryId
  );

  const subcategoryOptions = useMemo(
    () =>
      equipmentSubcategories.filter(
        (s) =>
          s.equipment_category_id === equipmentCategoryId &&
          (s.is_active || s.id === equipmentSubcategoryId)
      ),
    [equipmentCategoryId, equipmentSubcategoryId, equipmentSubcategories]
  );

  useEffect(() => {
    if (
      equipmentSubcategoryId &&
      !subcategoryOptions.some((s) => s.id === equipmentSubcategoryId)
    ) {
      setEquipmentSubcategoryId("");
    }
  }, [equipmentSubcategoryId, subcategoryOptions]);

  function onAssignmentTypeChange(next: EquipmentAssignmentType | "") {
    setAssignmentType(next);
    if (next !== "person") setAssignedTo("");
    if (next !== "station") setAssignedStation("");
    if (next !== "apparatus") setAssignedApparatusId("");
  }

  function buildInput(): AssetFormInput {
    const costTrimmed = purchaseCost.trim();
    const parsedCost =
      kind === "ppe" && costTrimmed !== "" ? Number(costTrimmed) : null;

    return {
      kind,
      name: kind === "ppe" ? name : undefined,
      status,
      station: kind === "apparatus" ? station : "",
      manufacturer,
      model,
      serial_number: serialNumber,
      notes,
      assignment_type: kind === "ppe" ? assignmentType || null : null,
      assigned_to: kind === "ppe" && assignmentType === "person" ? assignedTo || null : null,
      assigned_station:
        kind === "ppe" && assignmentType === "station" ? assignedStation || null : null,
      assigned_apparatus_id:
        kind === "ppe" && assignmentType === "apparatus" ? assignedApparatusId || null : null,
      equipment_category_id: kind === "ppe" ? equipmentCategoryId || null : null,
      equipment_subcategory_id: kind === "ppe" ? equipmentSubcategoryId || null : null,
      description: kind === "ppe" ? description : null,
      purchase_cost: kind === "ppe" ? parsedCost : null,
      in_service_on: kind === "ppe" ? inServiceOn || null : null,
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
          <FieldLabel htmlFor="name">Equipment ID</FieldLabel>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Department serial / tag"
          />
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

      <div className={kind === "apparatus" ? "grid gap-4 sm:grid-cols-2" : undefined}>
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
        {kind === "apparatus" ? (
          <div className="space-y-2">
            <FieldLabel htmlFor="station">Location</FieldLabel>
            <Select
              id="station"
              value={station}
              onChange={(e) => setStation(e.target.value)}
            >
              <option value="">Unassigned</option>
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
        ) : null}
      </div>

      {kind === "ppe" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="equipment_category_id">Category</FieldLabel>
              <Select
                id="equipment_category_id"
                required
                value={equipmentCategoryId}
                onChange={(e) => {
                  setEquipmentCategoryId(e.target.value);
                  setEquipmentSubcategoryId("");
                }}
              >
                <option value="" disabled>
                  Select category
                </option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.is_active ? " (inactive)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="equipment_subcategory_id">Subcategory</FieldLabel>
              <Select
                id="equipment_subcategory_id"
                value={equipmentSubcategoryId}
                disabled={!equipmentCategoryId}
                onChange={(e) => setEquipmentSubcategoryId(e.target.value)}
              >
                <option value="">None</option>
                {subcategoryOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {!s.is_active ? " (inactive)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <FieldLabel htmlFor="serial_number">Serial number</FieldLabel>
              <Input
                id="serial_number"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="model">Model number</FieldLabel>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="manufacturer">Manufacturer</FieldLabel>
              <Input
                id="manufacturer"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="manufactured_on">Manufacture date</FieldLabel>
              <Input
                id="manufactured_on"
                type="date"
                value={manufacturedOn}
                onChange={(e) => setManufacturedOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="expires_on">Replacement date</FieldLabel>
              <Input
                id="expires_on"
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <FieldLabel htmlFor="size">Size</FieldLabel>
              <Input id="size" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="purchase_cost">Purchase cost</FieldLabel>
              <Input
                id="purchase_cost"
                type="number"
                min={0}
                step="0.01"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="in_service_on">In service date</FieldLabel>
              <Input
                id="in_service_on"
                type="date"
                value={inServiceOn}
                onChange={(e) => setInServiceOn(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="assignment_type">Assigned to</FieldLabel>
            <Select
              id="assignment_type"
              value={assignmentType}
              onChange={(e) =>
                onAssignmentTypeChange(e.target.value as EquipmentAssignmentType | "")
              }
            >
              <option value="">Unassigned</option>
              <option value="person">Individual</option>
              <option value="station">Station</option>
              <option value="apparatus">Apparatus</option>
            </Select>
          </div>

          {assignmentType === "person" ? (
            <div className="space-y-2">
              <FieldLabel htmlFor="assigned_to">Individual</FieldLabel>
              <Select
                id="assigned_to"
                required
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Select person</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {profileLabel(p)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {assignmentType === "station" ? (
            <div className="space-y-2">
              <FieldLabel htmlFor="assigned_station">Station</FieldLabel>
              <Select
                id="assigned_station"
                required
                value={assignedStation}
                onChange={(e) => setAssignedStation(e.target.value)}
              >
                <option value="">Select station</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.name}>
                    {location.name}
                  </option>
                ))}
                {assignedStation &&
                !locations.some((location) => location.name === assignedStation) ? (
                  <option value={assignedStation}>{assignedStation} (inactive)</option>
                ) : null}
              </Select>
            </div>
          ) : null}

          {assignmentType === "apparatus" ? (
            <div className="space-y-2">
              <FieldLabel htmlFor="assigned_apparatus_id">Apparatus</FieldLabel>
              <Select
                id="assigned_apparatus_id"
                required
                value={assignedApparatusId}
                onChange={(e) => setAssignedApparatusId(e.target.value)}
              >
                <option value="">Select apparatus</option>
                {apparatusOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {apparatusOptionLabel(option)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
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
