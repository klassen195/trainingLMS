"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  addBagLine,
  addLooseLine,
  copyBagLoadout,
  reorderBagLines,
  attachAssetToBag,
  markBagBulk,
  markPlacement,
  removeBagLine,
  setBagBulk,
  setBagExpected,
  untrackPlacement,
} from "@/app/assets/rope/actions";
import { RopeAuditButton, RopeAuditFlag } from "@/components/RopeAudit";
import { RopeEditFrame } from "@/components/RopeEditFrame";
import { NameEditor } from "@/components/RopeForms";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { assetStatusLabel } from "@/lib/labels";
import { groupByCategory, ropeAuditReasonLabel, ropeComplementLabel, ropeGearOptionLabel, ropeGearSummary, type RopeAttachOption, type RopeBagLineView, type RopeGearType, type RopeLoadoutTarget } from "@/lib/rope-types";

function useRopeMutation() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<void>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
        router.refresh();
        after?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return { error, pending, run };
}

export function RopeBagSection({
  header,
  canManage,
  bagName,
  redirectTo,
  bagId,
  lines,
  gearTypes,
  loadoutTargets,
  ...panel
}: {
  header: ReactNode;
  canManage: boolean;
  bagId: string;
  bagName: string;
  redirectTo: string;
  lines: RopeBagLineView[];
  gearTypes: RopeGearType[];
  loadoutTargets: RopeLoadoutTarget[];
  attachOptions: RopeAttachOption[];
}) {
  const used = new Set(lines.filter((line) => line.persisted).map((line) => line.gearTypeId));
  const availableTypes = gearTypes.filter((type) => !used.has(type.id));

  return (
    <RopeEditFrame
      canManage={canManage}
      editLabel="Edit bag"
      actions={
        canManage ? (
          <RopeAuditButton
            label="Audit bag"
            bagId={bagId}
            groups={[
              {
                bagId,
                bagName,
                loose: false,
                lines: lines
                  .filter((line) => line.persisted && line.expectedQuantity > 0)
                  .map((line) => ({
                    lineId: line.id,
                    bagId,
                    gearTypeId: line.gearTypeId,
                    gearTypeName: line.gearTypeName,
                    gearSpec: line.gearSpec,
                    expectedQuantity: line.expectedQuantity,
                  })),
              },
            ]}
          />
        ) : undefined
      }
      header={header}
      editor={
        <>
          <NameEditor id={bagId} name={bagName} kind="bag" redirectTo={redirectTo} />
          {gearTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add gear types from the{" "}
              <Link href="/assets/rope/cache" className="text-primary underline-offset-4 hover:underline">
                reserve cache
              </Link>{" "}
              before building this loadout.
            </p>
          ) : (
            <>
              <AddLineForm bagId={bagId} types={availableTypes} />
              <CopyLoadoutForm
                bagId={bagId}
                targets={loadoutTargets}
                canCopyFromHere={lines.some((line) => line.persisted && line.expectedQuantity > 0)}
              />
            </>
          )}
        </>
      }
    >
      <RopeBagPanel canManage={canManage} bagId={bagId} lines={lines} place="bag" {...panel} />
    </RopeEditFrame>
  );
}

export function RopeLooseSection({
  canManage,
  compartmentId,
  bagId,
  lines,
  gearTypes,
  ...panel
}: {
  canManage: boolean;
  compartmentId: string;
  bagId: string | null;
  lines: RopeBagLineView[];
  gearTypes: RopeGearType[];
  attachOptions: RopeAttachOption[];
}) {
  const used = new Set(lines.filter((line) => line.persisted).map((line) => line.gearTypeId));
  const availableTypes = gearTypes.filter((type) => !used.has(type.id));
  const short = lines.reduce((sum, line) => sum + line.short, 0);
  const requiredLineCount = lines.filter((line) => line.expectedQuantity > 0).length;

  return (
    <div className="mt-6 border-t pt-4">
      <RopeEditFrame
        canManage={canManage}
        editLabel="Edit loose gear"
        header={
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Loose equipment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {lines.length === 0
                ? "Gear stored in this compartment, outside of a bag."
                : `${ropeComplementLabel(short, requiredLineCount)}. Required gear compared with what is loose in the compartment.`}
            </p>
          </div>
        }
        editor={
          gearTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add gear types from the{" "}
              <Link href="/assets/rope/cache" className="text-primary underline-offset-4 hover:underline">
                reserve cache
              </Link>{" "}
              before adding loose equipment.
            </p>
          ) : (
            <AddLineForm bagId={bagId} compartmentId={compartmentId} types={availableTypes} />
          )
        }
      >
        <RopeBagPanel
          canManage={canManage}
          bagId={bagId}
          lines={lines}
          place="compartment"
          emptyMessage="No loose equipment."
          {...panel}
        />
      </RopeEditFrame>
    </div>
  );
}

function LineSummary({ line }: { line: RopeBagLineView }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{line.gearTypeName}</span>
        {line.gearSpec ? (
          <span className="block truncate text-xs text-muted-foreground">{line.gearSpec}</span>
        ) : null}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {line.actual} / {line.expectedQuantity}
      </span>
      {line.auditFlag ? <RopeAuditFlag flag={line.auditFlag} /> : null}
      {line.short > 0 ? (
        <span className="shrink-0 rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
          Short {line.short}
        </span>
      ) : null}
    </>
  );
}

function SortableBagLine({
  line,
  onOpen,
}: {
  line: RopeBagLineView;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 bg-background shadow-md" : undefined}
    >
      <div className="flex items-center">
        <button
          type="button"
          className="flex shrink-0 cursor-grab touch-none items-center px-2 py-2.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Reorder ${line.gearTypeName}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-3 text-left text-sm hover:bg-accent"
          onClick={onOpen}
        >
          <LineSummary line={line} />
        </button>
      </div>
    </li>
  );
}

function RopeBagPanel({
  canManage,
  bagId,
  lines,
  attachOptions,
  place,
  emptyMessage,
}: {
  canManage: boolean;
  bagId: string | null;
  lines: RopeBagLineView[];
  attachOptions: RopeAttachOption[];
  place: "bag" | "compartment";
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ordered, setOrdered] = useState(lines);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [reorderReady, setReorderReady] = useState(false);
  const [, startOrder] = useTransition();
  const openLine = ordered.find((line) => line.id === openId) ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const canReorder =
    reorderReady && canManage && Boolean(bagId) && ordered.filter((line) => line.persisted).length > 1;

  useEffect(() => {
    setReorderReady(true);
  }, []);

  useEffect(() => {
    setOrdered(lines);
  }, [lines]);

  function openLineById(id: string) {
    setOpenId(id);
    setOpen(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !bagId) return;
    const oldIndex = ordered.findIndex((line) => line.id === active.id);
    const newIndex = ordered.findIndex((line) => line.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(ordered, oldIndex, newIndex);
    const previous = ordered;
    setOrdered(next);
    setOrderError(null);
    startOrder(async () => {
      try {
        await reorderBagLines(
          bagId,
          next.filter((line) => line.persisted).map((line) => line.id)
        );
        router.refresh();
      } catch (err) {
        setOrdered(previous);
        setOrderError(err instanceof Error ? err.message : "Could not save the new order.");
      }
    });
  }

  const list = (
    <ul className="divide-y overflow-hidden rounded-lg border">
      {ordered.map((line) =>
        canReorder && line.persisted ? (
          <SortableBagLine key={line.id} line={line} onOpen={() => openLineById(line.id)} />
        ) : (
          <li key={line.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent"
              onClick={() => openLineById(line.id)}
            >
              <LineSummary line={line} />
            </button>
          </li>
        )
      )}
    </ul>
  );

  return (
    <div className="space-y-3">
      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {emptyMessage ?? "This bag is empty. Add a gear type to set the required loadout."}
        </p>
      ) : canReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={ordered.filter((line) => line.persisted).map((line) => line.id)}
            strategy={verticalListSortingStrategy}
          >
            {list}
          </SortableContext>
        </DndContext>
      ) : (
        list
      )}
      {orderError ? <FieldError>{orderError}</FieldError> : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-md"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {openLine ? (
            <div className="flex-1 overflow-y-auto p-6">
                <BagLineEditor
                key={openLine.id}
                line={openLine}
                canManage={canManage}
                place={place}
                attachOptions={attachOptions}
                onRemoved={() => setOpen(false)}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

    </div>
  );
}

function AddLineForm({
  bagId,
  compartmentId,
  types,
}: {
  bagId: string | null;
  compartmentId?: string;
  types: RopeGearType[];
}) {
  const { error, pending, run } = useRopeMutation();
  const [gearTypeId, setGearTypeId] = useState("");
  const [expected, setExpected] = useState("1");

  useEffect(() => {
    if (gearTypeId && !types.some((type) => type.id === gearTypeId)) setGearTypeId("");
  }, [types, gearTypeId]);

  if (types.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every gear type is already listed. Add a new type from the{" "}
        <Link href="/assets/rope/cache" className="text-primary underline-offset-4 hover:underline">
          reserve cache
        </Link>
        .
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!gearTypeId) return;
        run(() =>
          bagId
            ? addBagLine(bagId, gearTypeId, Number(expected))
            : addLooseLine(compartmentId ?? "", gearTypeId, Number(expected))
        );
      }}
    >
      <div className="min-w-48 flex-1 space-y-1">
        <FieldLabel htmlFor="new-line-type">Add to loadout</FieldLabel>
        <Select
          id="new-line-type"
          value={gearTypeId}
          disabled={pending}
          className={gearTypeId ? undefined : "text-muted-foreground"}
          onChange={(event) => setGearTypeId(event.target.value)}
        >
          <option value="" disabled hidden>
            Select a gear type
          </option>
          {groupByCategory(
            types,
            (type) => ropeGearOptionLabel(type.name, ropeGearSummary(type.detailKind, type)),
            (type) => type.sort_order
          ).map(
            (group) => (
              <optgroup key={group.id} label={group.name}>
                {group.items.map((type) => (
                  <option key={type.id} value={type.id}>
                    {ropeGearOptionLabel(type.name, ropeGearSummary(type.detailKind, type))}
                  </option>
                ))}
              </optgroup>
            )
          )}
        </Select>
      </div>
      <div className="w-28 space-y-1">
        <FieldLabel htmlFor="new-line-expected">Required</FieldLabel>
        <Input
          id="new-line-expected"
          type="number"
          min={0}
          max={10000}
          step={1}
          inputMode="numeric"
          value={expected}
          disabled={pending}
          onChange={(event) => setExpected(event.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={pending || !gearTypeId}>
        Add item
      </Button>
      {error ? <FieldError className="w-full">{error}</FieldError> : null}
    </form>
  );
}

function CopyLoadoutForm({
  bagId,
  targets,
  canCopyFromHere,
}: {
  bagId: string;
  targets: RopeLoadoutTarget[];
  canCopyFromHere: boolean;
}) {
  const { error, pending, run } = useRopeMutation();
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const target = targets.find((item) => item.id === targetId) ?? null;

  useEffect(() => {
    if (targetId && !targets.some((item) => item.id === targetId)) setTargetId("");
  }, [targets, targetId]);

  if (targets.length === 0) {
    return (
      <p className="border-t pt-4 text-sm text-muted-foreground">
        Add another bag before copying this loadout.
      </p>
    );
  }

  return (
    <form
      className="space-y-2 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!target || !canCopyFromHere) return;
        setMessage(null);
        run(
          () => copyBagLoadout(bagId, target.id),
          () => {
            setMessage(`Copied the required loadout to ${target.label}.`);
            setTargetId("");
          }
        );
      }}
    >
      <div className="min-w-48 space-y-1">
        <FieldLabel htmlFor="copy-loadout-target">Copy loadout to</FieldLabel>
        <Select
          id="copy-loadout-target"
          value={targetId}
          disabled={pending}
          className={targetId ? undefined : "text-muted-foreground"}
          onChange={(event) => {
            setTargetId(event.target.value);
            setMessage(null);
          }}
        >
          <option value="" disabled hidden>
            Select a bag
          </option>
          {targets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        {canCopyFromHere
          ? "Copies the required gear and quantities. Gear already in either bag stays where it is."
          : "Add required gear to this bag before copying its loadout."}
      </p>
      <Button type="submit" size="sm" disabled={pending || !targetId || !canCopyFromHere}>
        Copy loadout
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </form>
  );
}

const COUNT_AUTOSAVE_MS = 400;

function wholeCount(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (parsed > 10000) return null;
  return parsed;
}

function useAutosaveCount(
  value: string,
  saved: number,
  label: string,
  save: (next: number) => Promise<void>,
  onError: (message: string | null) => void
) {
  const router = useRouter();
  const debounced = useDebouncedValue(value, COUNT_AUTOSAVE_MS);
  const savedRef = useRef(saved);
  const latest = useRef<number | null>(null);
  const writing = useRef(false);
  const saveRef = useRef(save);
  savedRef.current = saved;
  saveRef.current = save;

  const flush = useCallback(
    (raw: string) => {
      const parsed = wholeCount(raw);
      if (parsed === null) {
        onError(`${label} must be a whole number from 0 to 10000.`);
        return;
      }
      if (parsed === savedRef.current && latest.current === null) return;
      onError(null);
      latest.current = parsed;
      if (writing.current) return;
      writing.current = true;
      void (async () => {
        try {
          while (latest.current !== null) {
            const next = latest.current;
            latest.current = null;
            if (next === savedRef.current) continue;
            await saveRef.current(next);
            savedRef.current = next;
          }
          router.refresh();
        } catch (err) {
          onError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
          writing.current = false;
          if (latest.current !== null) flush(String(latest.current));
        }
      })();
    },
    [label, onError, router]
  );

  useEffect(() => {
    flush(debounced);
  }, [debounced, flush]);

  return () => flush(value);
}

function BagLineEditor({
  line,
  canManage,
  place,
  attachOptions,
  onRemoved,
}: {
  line: RopeBagLineView;
  canManage: boolean;
  place: "bag" | "compartment";
  attachOptions: RopeAttachOption[];
  onRemoved: () => void;
}) {
  const placeLabel = place === "compartment" ? "compartment" : "bag";
  const { error, pending, run } = useRopeMutation();
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [expected, setExpected] = useState(String(line.expectedQuantity));
  const [bulk, setBulk] = useState(String(line.quantityOnHand));
  const expectedDirty = useRef(false);
  const bulkDirty = useRef(false);
  const saveExpected = useCallback((next: number) => setBagExpected(line.id, next), [line.id]);
  const saveBulk = useCallback((next: number) => setBagBulk(line.id, next), [line.id]);
  const flushExpected = useAutosaveCount(expected, line.expectedQuantity, "Par", saveExpected, setFieldError);
  const flushBulk = useAutosaveCount(bulk, line.quantityOnHand, "On hand", saveBulk, setFieldError);
  const [markQty, setMarkQty] = useState("1");
  const [assetId, setAssetId] = useState("");
  const [assetQuery, setAssetQuery] = useState("");

  useEffect(() => {
    const server = String(line.expectedQuantity);
    if (expectedDirty.current && expected !== server) return;
    expectedDirty.current = false;
    if (expected !== server) setExpected(server);
  }, [expected, line.expectedQuantity]);

  useEffect(() => {
    const server = String(line.quantityOnHand);
    if (bulkDirty.current && bulk !== server) return;
    bulkDirty.current = false;
    if (bulk !== server) setBulk(server);
  }, [bulk, line.quantityOnHand]);

  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    const matches = query
      ? attachOptions.filter((option) => option.label.toLowerCase().includes(query))
      : attachOptions;
    return matches.slice(0, 40);
  }, [assetQuery, attachOptions]);

  return (
    <>
      <SheetHeader className="pr-8 text-left">
        <SheetTitle>{line.gearTypeName}</SheetTitle>
        <SheetDescription>
          {line.gearSpec ? `${line.gearSpec} · ` : ""}
          Par {line.expectedQuantity} · In the bag {line.actual}
          {line.auditFlag ? ` · ${ropeAuditReasonLabel(line.auditFlag.reason)} ${line.auditFlag.quantity}` : ""}
          {line.short > 0 ? ` · Short ${line.short}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-5">
        {line.assets.length > 0 ? (
          <ul className="space-y-3">
            {line.assets.map((asset) => (
              <li key={asset.placementId} className="space-y-2 text-sm">
                <span className="block">
                  <Link href={`/assets/${asset.assetId}`} className="font-medium hover:underline">
                    {asset.label}
                  </Link>
                  <span className="ml-2 text-muted-foreground">{assetStatusLabel(asset.status)}</span>
                </span>
                {canManage ? (
                  <span className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => markPlacement(asset.placementId, "missing"))}
                    >
                      Missing
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => markPlacement(asset.placementId, "broken"))}
                    >
                      Broken
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`Remove this equipment from the ${placeLabel} and leave it unassigned?`)) return;
                        run(() => untrackPlacement(asset.placementId));
                      }}
                    >
                      Untrack
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No individual equipment is linked to this item.</p>
        )}

        {canManage && line.persisted ? (
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-1">
              <FieldLabel htmlFor={`expected-${line.id}`}>Par</FieldLabel>
              <Input
                id={`expected-${line.id}`}
                type="number"
                min={0}
                max={10000}
                step={1}
                inputMode="numeric"
                value={expected}
                onChange={(event) => {
                  expectedDirty.current = true;
                  setExpected(event.target.value);
                }}
                onBlur={flushExpected}
              />
            </div>

            <div className="space-y-1">
              <FieldLabel htmlFor={`bulk-${line.id}`}>On hand</FieldLabel>
              <Input
                id={`bulk-${line.id}`}
                type="number"
                min={0}
                max={10000}
                step={1}
                inputMode="numeric"
                value={bulk}
                onChange={(event) => {
                  bulkDirty.current = true;
                  setBulk(event.target.value);
                }}
                onBlur={flushBulk}
              />
            </div>

            {line.quantityOnHand > 0 ? (
              <div className="space-y-2">
                <FieldLabel htmlFor={`mark-${line.id}`}>Bulk quantity</FieldLabel>
                <Input
                  id={`mark-${line.id}`}
                  type="number"
                  min={1}
                  max={line.quantityOnHand}
                  step={1}
                  inputMode="numeric"
                  value={markQty}
                  disabled={pending}
                  onChange={(event) => setMarkQty(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => markBagBulk(line.id, Number(markQty), "missing"))}
                  >
                    Mark missing
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => markBagBulk(line.id, Number(markQty), "broken"))}
                  >
                    Mark broken
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2 border-t pt-4">
              <FieldLabel htmlFor={`attach-search-${line.id}`}>Attach equipment</FieldLabel>
              <Input
                id={`attach-search-${line.id}`}
                value={assetQuery}
                placeholder="Search the equipment list"
                disabled={pending}
                onChange={(event) => setAssetQuery(event.target.value)}
              />
              <Select
                aria-label={`Equipment for ${line.gearTypeName}`}
                value={assetId}
                disabled={pending || filteredAssets.length === 0}
                onChange={(event) => setAssetId(event.target.value)}
              >
                <option value="">Select equipment</option>
                {filteredAssets.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={pending || !assetId}
                onClick={() => run(() => attachAssetToBag(line.id, assetId))}
              >
                Attach
              </Button>
            </div>
            <div className="border-t pt-4">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  const linked =
                    line.assets.length > 0 ? " Linked equipment stays in service and unassigned." : "";
                  if (!window.confirm(`Remove ${line.gearTypeName} from this ${placeLabel}?${linked}`)) return;
                  run(() => removeBagLine(line.id), onRemoved);
                }}
              >
                Remove from {placeLabel}
              </Button>
            </div>
            {fieldError || error ? <FieldError>{fieldError || error}</FieldError> : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
