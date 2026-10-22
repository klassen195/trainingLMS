"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
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
  deleteGearType,
  placeAssetInCache,
  receiveCacheBulk,
  reorderGearCategories,
  reorderGearTypes,
  sendCacheAssetToBag,
  sendCacheBulkToBag,
  setCacheBulk,
  untrackPlacement,
  updateGearType,
} from "@/app/assets/rope/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { GearSpecFields } from "@/components/RopeForms";
import { Input, Select, Textarea } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { assetStatusLabel } from "@/lib/labels";
import { cacheRowSearchText, groupByCategory, type RopeAttachOption, type RopeCacheRow, type RopeGearCategory, type RopeGearSpecs, type RopeLoadoutTarget } from "@/lib/rope-types";

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

export function RopeCachePanel({
  canManage,
  rows,
  categories,
  attachOptions,
  bags,
}: {
  canManage: boolean;
  rows: RopeCacheRow[];
  categories: RopeGearCategory[];
  attachOptions: RopeAttachOption[];
  bags: RopeLoadoutTarget[];
}) {
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = rows.find((row) => row.gearTypeId === openId) ?? null;

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gear in the reserve cache yet.</p>
      ) : (
        <CacheSortableList
          rows={rows}
          categories={categories}
          canManage={canManage}
          onOpen={(gearTypeId) => {
            setOpenId(gearTypeId);
            setOpen(true);
          }}
        />
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-md"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {openRow ? (
            <div className="flex-1 overflow-y-auto p-6">
              <CacheEditor
                key={openRow.gearTypeId}
                row={openRow}
                categories={categories}
                canManage={canManage}
                attachOptions={attachOptions}
                bags={bags}
                onClose={() => setOpen(false)}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function mergeCategoryOrder(categories: RopeGearCategory[], visibleIds: string[]) {
  const visible = new Set(visibleIds);
  let cursor = 0;
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((category) => (visible.has(category.id) ? visibleIds[cursor++] : category.id));
}

function useSortSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

function CacheSortableList({
  rows,
  categories,
  canManage,
  onOpen,
}: {
  rows: RopeCacheRow[];
  categories: RopeGearCategory[];
  canManage: boolean;
  onOpen: (gearTypeId: string) => void;
}) {
  const router = useRouter();
  const [ordered, setOrdered] = useState(rows);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [, startOrder] = useTransition();
  const sensors = useSortSensors();
  const normalizedQuery = query.trim().toLowerCase();
  const filtering = Boolean(normalizedQuery || categoryId);
  const visible = ordered.filter((row) => {
    if (categoryId && row.categoryId !== categoryId) return false;
    if (!normalizedQuery) return true;
    return cacheRowSearchText(row).includes(normalizedQuery);
  });
  const groups = groupByCategory(
    visible,
    (row) => `${row.gearTypeName} ${row.summary}`,
    (row) => row.sortOrder
  );
  const categoryOptions = categories.filter((category) => category.gearTypeCount > 0);
  const canSortCategories = !filtering && ready && canManage && groups.length > 1;

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    setOrdered(rows);
  }, [rows]);

  function saveOrder(next: RopeCacheRow[], task: () => Promise<void>) {
    const previous = ordered;
    setOrdered(next);
    setError(null);
    startOrder(async () => {
      try {
        await task();
        router.refresh();
      } catch (err) {
        setOrdered(previous);
        setError(err instanceof Error ? err.message : "Could not save the new order.");
      }
    });
  }

  function onCategoryDragEnd(activeId: string, overId: string) {
    const oldIndex = groups.findIndex((group) => group.id === activeId);
    const newIndex = groups.findIndex((group) => group.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const visibleIds = arrayMove(groups, oldIndex, newIndex).map((group) => group.id);
    const full = mergeCategoryOrder(categories, visibleIds);
    const rank = new Map(full.map((id, index) => [id, index + 1]));
    saveOrder(
      ordered.map((row) => ({
        ...row,
        categorySortOrder: rank.get(row.categoryId) ?? row.categorySortOrder,
      })),
      () => reorderGearCategories(full)
    );
  }

  function onItemDragEnd(categoryId: string, activeId: string, overId: string) {
    const items = groups.find((group) => group.id === categoryId)?.items ?? [];
    const oldIndex = items.findIndex((row) => row.gearTypeId === activeId);
    const newIndex = items.findIndex((row) => row.gearTypeId === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const gearTypeIds = arrayMove(items, oldIndex, newIndex).map((row) => row.gearTypeId);
    const rank = new Map(gearTypeIds.map((id, index) => [id, index + 1]));
    saveOrder(
      ordered.map((row) =>
        row.categoryId === categoryId ? { ...row, sortOrder: rank.get(row.gearTypeId) ?? row.sortOrder } : row
      ),
      () => reorderGearTypes(categoryId, gearTypeIds)
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : "";
    const activeId = String(event.active.id);
    if (!overId || activeId === overId) return;
    if (activeId.startsWith("category:") && overId.startsWith("category:")) {
      onCategoryDragEnd(activeId.slice("category:".length), overId.slice("category:".length));
      return;
    }
    if (activeId.startsWith("item:") && overId.startsWith("item:")) {
      const gearTypeId = activeId.slice("item:".length);
      const overGearTypeId = overId.slice("item:".length);
      const categoryId = ordered.find((row) => row.gearTypeId === gearTypeId)?.categoryId;
      const overCategoryId = ordered.find((row) => row.gearTypeId === overGearTypeId)?.categoryId;
      if (!categoryId || categoryId !== overCategoryId) return;
      onItemDragEnd(categoryId, gearTypeId, overGearTypeId);
    }
  }

  const canSort =
    !filtering && ready && canManage && (groups.length > 1 || groups.some((group) => group.items.length > 1));
  const sections = groups.map((group) => (
    <CacheCategorySection
      key={group.id}
      group={group}
      sortable={canSortCategories}
      canSortItems={!filtering && ready && canManage && group.items.length > 1}
      canManage={canManage}
      onOpen={onOpen}
    />
  ));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          value={query}
          placeholder="Filter by name, color, size…"
          aria-label="Filter cache"
          className="min-w-52 flex-1"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          value={categoryId}
          aria-label="Filter by category"
          className="w-full sm:w-52"
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">All categories</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gear matches that filter.</p>
      ) : canSort ? (
        <DndContext id="cache-sort" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={groups.map((group) => `category:${group.id}`)} strategy={verticalListSortingStrategy}>
            {sections}
          </SortableContext>
        </DndContext>
      ) : (
        sections
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

function CacheCategorySection({
  group,
  sortable,
  canSortItems,
  canManage,
  onOpen,
}: {
  group: { id: string; name: string; items: RopeCacheRow[] };
  sortable: boolean;
  canSortItems: boolean;
  canManage: boolean;
  onOpen: (gearTypeId: string) => void;
}) {
  const heading = <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.name}</h2>;
  const list = <CacheItemList items={group.items} canSort={canSortItems} canManage={canManage} onOpen={onOpen} />;

  if (!sortable) {
    return (
      <section>
        <div className="mb-1">{heading}</div>
        {list}
      </section>
    );
  }

  return (
    <section>
      <SortableCategoryFrame id={group.id} name={group.name} />
      {list}
    </section>
  );
}

function SortableCategoryFrame({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `category:${id}`,
  });
  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 rounded-lg bg-background shadow-md" : undefined}
    >
      <div className="mb-1 flex items-center gap-1">
        <button
          type="button"
          className="flex shrink-0 cursor-grab touch-none items-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Reorder ${name} category`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{name}</h2>
      </div>
    </section>
  );
}

function CacheItemList({
  items,
  canSort,
  canManage,
  onOpen,
}: {
  items: RopeCacheRow[];
  canSort: boolean;
  canManage: boolean;
  onOpen: (gearTypeId: string) => void;
}) {
  const list = (
    <ul className="divide-y overflow-hidden rounded-lg border">
      {items.map((row) =>
        canSort ? (
          <SortableCacheItem key={row.gearTypeId} row={row} canManage={canManage} onOpen={() => onOpen(row.gearTypeId)} />
        ) : (
          <li key={row.gearTypeId}>
            <CacheListItem row={row} canManage={canManage} onOpen={() => onOpen(row.gearTypeId)} />
          </li>
        )
      )}
    </ul>
  );

  if (!canSort) return list;

  return (
    <SortableContext items={items.map((row) => `item:${row.gearTypeId}`)} strategy={verticalListSortingStrategy}>
      {list}
    </SortableContext>
  );
}

function SortableCacheItem({
  row,
  canManage,
  onOpen,
}: {
  row: RopeCacheRow;
  canManage: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item:${row.gearTypeId}`,
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
          aria-label={`Reorder ${row.summary ? `${row.gearTypeName}, ${row.summary}` : row.gearTypeName}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <CacheListItem row={row} canManage={canManage} onOpen={onOpen} />
        </div>
      </div>
    </li>
  );
}

function CacheListItem({
  row,
  canManage,
  onOpen,
}: {
  row: RopeCacheRow;
  canManage: boolean;
  onOpen: () => void;
}) {
  const spareCount = row.spares.length;
  const detail = [row.summary, row.description].filter(Boolean).join(" — ");
  const summary = (
    <span className="min-w-0 flex-1">
      <span className="flex items-baseline gap-3">
        <span className="truncate font-medium">{row.gearTypeName}</span>
        <span className="shrink-0 tabular-nums text-sm text-muted-foreground">× {row.quantity}</span>
        {spareCount > 0 ? (
          <span className="shrink-0 text-xs text-muted-foreground">{spareCount} tracked</span>
        ) : null}
      </span>
      {detail ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span> : null}
    </span>
  );

  if (!canManage && spareCount === 0) {
    return <div className="flex items-center gap-3 px-3 py-2.5 text-sm">{summary}</div>;
  }

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent"
      onClick={onOpen}
    >
      {summary}
    </button>
  );
}

function CacheEditor({
  row,
  categories,
  canManage,
  attachOptions,
  bags,
  onClose,
}: {
  row: RopeCacheRow;
  categories: RopeGearCategory[];
  canManage: boolean;
  attachOptions: RopeAttachOption[];
  bags: RopeLoadoutTarget[];
  onClose: () => void;
}) {
  const { error, pending, run } = useRopeMutation();
  const [name, setName] = useState(row.gearTypeName);
  const [categoryId, setCategoryId] = useState(row.categoryId);
  const [description, setDescription] = useState(row.description);
  const [specs, setSpecs] = useState<RopeGearSpecs>({
    color: row.color,
    diameter: row.diameter,
    length: row.length,
    brand: row.brand,
    material: row.material,
  });
  const [quantity, setQuantity] = useState(String(row.quantity));
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const [receive, setReceive] = useState("1");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetId, setAssetId] = useState("");
  const [bagId, setBagId] = useState("");
  const [sendQty, setSendQty] = useState("1");
  const [spareId, setSpareId] = useState(row.spares[0]?.placementId ?? "");

  useEffect(() => {
    setName(row.gearTypeName);
    setCategoryId(row.categoryId);
    setDescription(row.description);
    setSpecs({
      color: row.color,
      diameter: row.diameter,
      length: row.length,
      brand: row.brand,
      material: row.material,
    });
    setQuantity(String(row.quantity));
  }, [
    row.gearTypeName,
    row.categoryId,
    row.description,
    row.color,
    row.diameter,
    row.length,
    row.brand,
    row.material,
    row.quantity,
  ]);

  useEffect(() => {
    if (!row.spares.some((spare) => spare.placementId === spareId)) {
      setSpareId(row.spares[0]?.placementId ?? "");
    }
  }, [row.spares, spareId]);

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
        <SheetTitle>{row.gearTypeName}</SheetTitle>
        <SheetDescription>
          {[row.summary, `${row.quantity} in cache`, row.spares.length > 0 ? `${row.spares.length} tracked` : ""]
            .filter(Boolean)
            .join(" · ")}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-5">
        {canManage ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <FieldLabel htmlFor={`cache-name-${row.gearTypeId}`}>Item</FieldLabel>
              <Input
                id={`cache-name-${row.gearTypeId}`}
                value={name}
                disabled={pending}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor={`cache-category-${row.gearTypeId}`}>Category</FieldLabel>
              <Select
                id={`cache-category-${row.gearTypeId}`}
                value={categoryId}
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
            <GearSpecFields
              detailKind={selectedCategory?.detailKind ?? row.detailKind}
              values={specs}
              disabled={pending}
              idPrefix={`cache-spec-${row.gearTypeId}`}
              onChange={setSpecs}
            />
            <div className="space-y-1">
              <FieldLabel htmlFor={`cache-description-${row.gearTypeId}`}>Description</FieldLabel>
              <Textarea
                id={`cache-description-${row.gearTypeId}`}
                value={description}
                disabled={pending}
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor={`cache-qty-${row.gearTypeId}`}>Quantity</FieldLabel>
              <Input
                id={`cache-qty-${row.gearTypeId}`}
                type="number"
                min={0}
                max={10000}
                step={1}
                inputMode="numeric"
                value={quantity}
                disabled={pending}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const nextQuantity = Number(quantity);
                  await updateGearType(row.gearTypeId, {
                    name,
                    categoryId,
                    description,
                    ...specs,
                  });
                  if (nextQuantity !== row.quantity) await setCacheBulk(row.gearTypeId, nextQuantity);
                })
              }
            >
              Save
            </Button>
          </div>
        ) : null}

        {row.spares.length > 0 ? (
          <ul className="space-y-2 border-t pt-4">
            {row.spares.map((spare) => (
              <li key={spare.placementId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <Link href={`/assets/${spare.assetId}`} className="font-medium hover:underline">
                    {spare.label}
                  </Link>
                  <span className="ml-2 text-muted-foreground">{assetStatusLabel(spare.status)}</span>
                </span>
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Remove this spare from the cache and leave it unassigned?")) return;
                      run(() => untrackPlacement(spare.placementId));
                    }}
                  >
                    Untrack
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {canManage && (row.quantity > 0 || row.spares.length > 0) ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Send to bag</p>
            {bags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bags to send to yet.</p>
            ) : (
              <>
                <div className="space-y-1">
                  <FieldLabel htmlFor={`cache-bag-${row.gearTypeId}`}>Bag</FieldLabel>
                  <Select
                    id={`cache-bag-${row.gearTypeId}`}
                    value={bagId}
                    disabled={pending}
                    className={bagId ? undefined : "text-muted-foreground"}
                    onChange={(event) => setBagId(event.target.value)}
                  >
                    <option value="" disabled hidden>
                      Select a bag
                    </option>
                    {bags.map((bag) => (
                      <option key={bag.id} value={bag.id}>
                        {bag.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground">The bag receives this gear. Its par stays the same.</p>
                {row.quantity > 0 ? (
                  <div className="flex items-end gap-2">
                    <div className="w-28 space-y-1">
                      <FieldLabel htmlFor={`cache-send-${row.gearTypeId}`}>How many</FieldLabel>
                      <Input
                        id={`cache-send-${row.gearTypeId}`}
                        type="number"
                        min={1}
                        max={row.quantity}
                        step={1}
                        inputMode="numeric"
                        value={sendQty}
                        disabled={pending}
                        onChange={(event) => setSendQty(event.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || !bagId}
                      onClick={() => run(() => sendCacheBulkToBag(row.gearTypeId, bagId, Number(sendQty)))}
                    >
                      Send
                    </Button>
                  </div>
                ) : null}
                {row.spares.length > 0 ? (
                  <div className="space-y-2">
                    <FieldLabel htmlFor={`cache-spare-${row.gearTypeId}`}>Tracked spare</FieldLabel>
                    <Select
                      id={`cache-spare-${row.gearTypeId}`}
                      value={spareId}
                      disabled={pending}
                      onChange={(event) => setSpareId(event.target.value)}
                    >
                      {row.spares.map((spare) => (
                        <option key={spare.placementId} value={spare.placementId}>
                          {spare.label}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || !bagId || !spareId}
                      onClick={() => run(() => sendCacheAssetToBag(spareId, bagId))}
                    >
                      Send spare
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {canManage ? (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-end gap-2">
              <div className="w-28 space-y-1">
                <FieldLabel htmlFor={`cache-receive-${row.gearTypeId}`}>Add</FieldLabel>
                <Input
                  id={`cache-receive-${row.gearTypeId}`}
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  inputMode="numeric"
                  value={receive}
                  disabled={pending}
                  onChange={(event) => setReceive(event.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => receiveCacheBulk(row.gearTypeId, Number(receive)))}
              >
                Add to cache
              </Button>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor={`cache-search-${row.gearTypeId}`}>Place equipment in the cache</FieldLabel>
              <Input
                id={`cache-search-${row.gearTypeId}`}
                value={assetQuery}
                placeholder="Search the equipment list"
                disabled={pending}
                onChange={(event) => setAssetQuery(event.target.value)}
              />
              <Select
                aria-label={`Spare equipment for ${row.gearTypeName}`}
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
                onClick={() => run(() => placeAssetInCache(row.gearTypeId, assetId))}
              >
                Place in cache
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Delete this gear type?")) return;
                run(() => deleteGearType(row.gearTypeId), onClose);
              }}
            >
              Delete
            </Button>
            {error ? <FieldError>{error}</FieldError> : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
