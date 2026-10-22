"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBag,
  createCompartment,
  createGearCategory,
  createGearType,
  deleteBag,
  deleteCompartment,
  deleteGearCategory,
  deleteGearType,
  renameBag,
  renameCompartment,
  renameGearType,
  setApparatusRopeTracking,
  updateGearCategory,
} from "@/app/assets/rope/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import {
  ropeDetailKindLabel,
  type RopeApparatusOption,
  type RopeDetailKind,
  type RopeGearCategory,
  type RopeGearSpecs,
} from "@/lib/rope-types";

function useRopeMutation() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<void>, after?: () => "skip-refresh" | void) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
        const result = after?.();
        if (result !== "skip-refresh") router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return { error, pending, run };
}

export function EnableRopeApparatusForm({ apparatus }: { apparatus: RopeApparatusOption[] }) {
  const available = apparatus.filter((unit) => !unit.tracksRope);
  const { error, pending, run } = useRopeMutation();
  const [apparatusId, setApparatusId] = useState(available[0]?.id ?? "");

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {apparatus.length === 0
          ? "Add an apparatus first, then turn on tech rescue inventory for it here."
          : "Every apparatus already tracks tech rescue inventory."}
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!apparatusId) return;
        run(() => setApparatusRopeTracking(apparatusId, true));
      }}
    >
      <div className="min-w-56 flex-1 space-y-1">
        <FieldLabel htmlFor="rope-apparatus">Track tech rescue on</FieldLabel>
        <Select
          id="rope-apparatus"
          value={apparatusId}
          disabled={pending}
          onChange={(event) => setApparatusId(event.target.value)}
        >
          {available.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label} · {unit.station}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={pending || !apparatusId}>
        Enable
      </Button>
      {error ? <FieldError className="w-full">{error}</FieldError> : null}
    </form>
  );
}

export function StopRopeTrackingButton({ apparatusId }: { apparatusId: string }) {
  const router = useRouter();
  const { error, pending, run } = useRopeMutation();

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Stop tracking tech rescue on this apparatus?")) return;
          run(
            () => setApparatusRopeTracking(apparatusId, false),
            () => {
              router.push("/assets/rope");
              return "skip-refresh";
            }
          );
        }}
      >
        Stop tracking tech rescue
      </Button>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

export function AddNameForm({
  label,
  placeholder,
  submitLabel,
  onAdd,
}: {
  label: string;
  placeholder: string;
  submitLabel: string;
  onAdd: (name: string) => Promise<void>;
}) {
  const { error, pending, run } = useRopeMutation();
  const [name, setName] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const next = name;
        run(
          () => onAdd(next),
          () => setName("")
        );
      }}
    >
      <div className="min-w-48 flex-1 space-y-1">
        <FieldLabel htmlFor={`add-${label}`}>{label}</FieldLabel>
        <Input
          id={`add-${label}`}
          value={name}
          placeholder={placeholder}
          disabled={pending}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {submitLabel}
      </Button>
      {error ? <FieldError className="w-full">{error}</FieldError> : null}
    </form>
  );
}

export function AddCompartmentForm({ apparatusId }: { apparatusId: string }) {
  return (
    <AddNameForm
      label="New compartment"
      placeholder="e.g. Rear compartment"
      submitLabel="Add compartment"
      onAdd={(name) => createCompartment(apparatusId, name)}
    />
  );
}

export function AddBagForm({ compartmentId }: { compartmentId: string }) {
  return (
    <AddNameForm
      label="New bag"
      placeholder="e.g. Main line bag"
      submitLabel="Add bag"
      onAdd={(name) => createBag(compartmentId, name)}
    />
  );
}

const EMPTY_SPECS: RopeGearSpecs = {
  color: "",
  diameter: "",
  length: "",
  brand: "",
  material: "",
};

export function GearSpecFields({
  detailKind,
  values,
  disabled,
  idPrefix,
  onChange,
}: {
  detailKind: RopeDetailKind;
  values: RopeGearSpecs;
  disabled: boolean;
  idPrefix: string;
  onChange: (values: RopeGearSpecs) => void;
}) {
  if (detailKind === "none") return null;
  const field = (
    key: keyof RopeGearSpecs,
    label: string,
    placeholder: string
  ) => (
    <div className="space-y-1">
      <FieldLabel htmlFor={`${idPrefix}-${key}`}>{label}</FieldLabel>
      <Input
        id={`${idPrefix}-${key}`}
        value={values[key]}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange({ ...values, [key]: event.target.value })}
      />
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {detailKind === "rope" || detailKind === "webbing" ? field("color", "Color", "Red") : null}
      {detailKind === "rope" ? field("diameter", "Diameter", "12.5 mm") : null}
      {detailKind === "rope" || detailKind === "webbing" ? field("length", "Length", "200 ft") : null}
      {detailKind === "carabiner" ? field("brand", "Brand", "CMC") : null}
      {detailKind === "carabiner" ? field("material", "Material", "Aluminum") : null}
    </div>
  );
}

export function AddGearTypeForm({ categories }: { categories: RopeGearCategory[] }) {
  const fallback = categories.find((category) => category.name === "Other") ?? categories[0];
  const { error, pending, run } = useRopeMutation();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(fallback?.id ?? "");
  const [description, setDescription] = useState("");
  const [specs, setSpecs] = useState<RopeGearSpecs>(EMPTY_SPECS);
  const selected = categories.find((category) => category.id === categoryId) ?? fallback;

  useEffect(() => {
    if (categoryId && categories.some((category) => category.id === categoryId)) return;
    setCategoryId(fallback?.id ?? "");
  }, [categories, categoryId, fallback?.id]);

  if (!selected) {
    return <p className="text-sm text-muted-foreground">Add a category before adding gear.</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const nextName = name;
        const nextDescription = description;
        const nextSpecs = specs;
        const nextCategory = selected.id;
        run(
          () =>
            createGearType({
              name: nextName,
              categoryId: nextCategory,
              description: nextDescription,
              ...nextSpecs,
            }),
          () => {
            setName("");
            setDescription("");
            setSpecs(EMPTY_SPECS);
          }
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <FieldLabel htmlFor="new-gear-name">New gear type</FieldLabel>
          <Input
            id="new-gear-name"
            value={name}
            placeholder="e.g. Rope"
            disabled={pending}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <FieldLabel htmlFor="new-gear-category">Category</FieldLabel>
          <Select
            id="new-gear-category"
            value={selected.id}
            disabled={pending}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <GearSpecFields
        detailKind={selected.detailKind}
        values={specs}
        disabled={pending}
        idPrefix="new-gear"
        onChange={setSpecs}
      />
      <div className="space-y-1">
        <FieldLabel htmlFor="new-gear-description">Description</FieldLabel>
        <Textarea
          id="new-gear-description"
          value={description}
          disabled={pending}
          rows={2}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Add gear type
      </Button>
      {error ? <FieldError>{error}</FieldError> : null}
    </form>
  );
}

function CategoryRow({ category }: { category: RopeGearCategory }) {
  const { error, pending, run } = useRopeMutation();
  const [name, setName] = useState(category.name);
  const [detailKind, setDetailKind] = useState<RopeDetailKind>(category.detailKind);

  useEffect(() => {
    setName(category.name);
    setDetailKind(category.detailKind);
  }, [category.name, category.detailKind]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1">
          <FieldLabel htmlFor={`category-${category.id}`}>Category</FieldLabel>
          <Input
            id={`category-${category.id}`}
            value={name}
            disabled={pending}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="min-w-44 space-y-1">
          <FieldLabel htmlFor={`category-kind-${category.id}`}>Details</FieldLabel>
          <Select
            id={`category-kind-${category.id}`}
            value={detailKind}
            disabled={pending}
            onChange={(event) => setDetailKind(event.target.value as RopeDetailKind)}
          >
            {(["none", "rope", "webbing", "carabiner"] as const).map((kind) => (
              <option key={kind} value={kind}>
                {ropeDetailKindLabel(kind)}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending || (name.trim() === category.name && detailKind === category.detailKind)}
          onClick={() => run(() => updateGearCategory(category.id, name, detailKind))}
        >
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || category.gearTypeCount > 0}
          title={category.gearTypeCount > 0 ? "Move gear out of this category before deleting it." : undefined}
          onClick={() => {
            if (!window.confirm(`Delete the ${category.name} category?`)) return;
            run(() => deleteGearCategory(category.id));
          }}
        >
          Delete
        </Button>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

export function GearCategoryEditor({ categories }: { categories: RopeGearCategory[] }) {
  const { error, pending, run } = useRopeMutation();
  const [name, setName] = useState("");
  const [detailKind, setDetailKind] = useState<RopeDetailKind>("none");

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Categories</p>
      <div className="space-y-3">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const nextName = name;
          const nextKind = detailKind;
          run(
            () => createGearCategory(nextName, nextKind),
            () => {
              setName("");
              setDetailKind("none");
            }
          );
        }}
      >
        <div className="min-w-40 flex-1 space-y-1">
          <FieldLabel htmlFor="new-category-name">New category</FieldLabel>
          <Input
            id="new-category-name"
            value={name}
            disabled={pending}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="min-w-44 space-y-1">
          <FieldLabel htmlFor="new-category-kind">Details</FieldLabel>
          <Select
            id="new-category-kind"
            value={detailKind}
            disabled={pending}
            onChange={(event) => setDetailKind(event.target.value as RopeDetailKind)}
          >
            {(["none", "rope", "webbing", "carabiner"] as const).map((kind) => (
              <option key={kind} value={kind}>
                {ropeDetailKindLabel(kind)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          Add category
        </Button>
        {error ? <FieldError className="w-full">{error}</FieldError> : null}
      </form>
    </div>
  );
}

export function NameEditor({
  id,
  name,
  kind,
  redirectTo,
  hideLabel = false,
  inputClassName,
}: {
  id: string;
  name: string;
  kind: "compartment" | "bag" | "gear";
  redirectTo?: string;
  hideLabel?: boolean;
  inputClassName?: string;
}) {
  const router = useRouter();
  const { error, pending, run } = useRopeMutation();
  const [value, setValue] = useState(name);
  const label = kind === "bag" ? "Bag name" : kind === "compartment" ? "Compartment name" : "Name";

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => {
          if (kind === "compartment") return renameCompartment(id, value);
          if (kind === "bag") return renameBag(id, value);
          return renameGearType(id, value);
        });
      }}
    >
      <div className="min-w-40 flex-1 space-y-1">
        <FieldLabel htmlFor={`rename-${id}`} className={hideLabel ? "sr-only" : undefined}>
          {label}
        </FieldLabel>
        <Input
          id={`rename-${id}`}
          value={value}
          disabled={pending}
          required
          className={inputClassName}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Rename
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          const noun = kind === "gear" ? "gear type" : kind;
          if (!window.confirm(`Delete this ${noun}?`)) return;
          run(
            async () => {
              if (kind === "compartment") await deleteCompartment(id);
              else if (kind === "bag") await deleteBag(id);
              else await deleteGearType(id);
            },
            () => {
              if (!redirectTo) return;
              router.push(redirectTo);
              return "skip-refresh";
            }
          );
        }}
      >
        Delete
      </Button>
      {error ? <FieldError className="w-full">{error}</FieldError> : null}
    </form>
  );
}
