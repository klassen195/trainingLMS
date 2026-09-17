"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Folder, FolderOpen, GripVertical } from "lucide-react";
import {
  createPersonnelCertification,
  createPersonnelCertificationSection,
  deletePersonnelCertification,
  deletePersonnelCertificationSection,
  getPersonnelCertificationDownloadUrl,
  reorderPersonnelCertificationLayout,
  updatePersonnelCertification,
  updatePersonnelCertificationSection,
} from "@/app/personnel/actions";
import { CertificationFilePreview } from "@/components/CertificationFilePreview";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fileAsJpegIfHeic } from "@/lib/heic";
import type {
  PersonnelCertification,
  PersonnelCertificationLayoutItem,
  PersonnelCertificationSection,
} from "@/lib/personnel-types";
import {
  buildPersonnelCertificationLayout,
  certificationLayoutContainerId,
  certificationLayoutOrderKey,
  groupPersonnelCertificationLayout,
  isCertExpired,
  isPersonnelDocumentFile,
  movePersonnelCertificationLayout,
  PERSONNEL_DOCUMENT_ACCEPT,
  PERSONNEL_DOCUMENTS_BUCKET,
} from "@/lib/personnel-types";
import { Button } from "@/components/ui/Button";
import { FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";

const certificationCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const certHit = pointerHits.find(
      (entry) => entry.data?.droppableContainer?.data?.current?.kind === "cert"
    );
    return certHit ? [certHit] : pointerHits.slice(0, 1);
  }
  return closestCenter(args);
};

export function PersonnelCertificationsPanel({
  profileId,
  certifications,
  sections = [],
  canManage,
  canOrganize = false,
}: {
  profileId: string;
  certifications: PersonnelCertification[];
  sections?: PersonnelCertificationSection[];
  canManage: boolean;
  canOrganize?: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [items, setItems] = useState(() =>
    buildPersonnelCertificationLayout(certifications, sections)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    setItems(buildPersonnelCertificationLayout(certifications, sections));
  }, [certifications, sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const layoutLocked = Boolean(editingId) || adding || pending;
  const { ungrouped, folders } = useMemo(
    () => groupPersonnelCertificationLayout(items),
    [items]
  );
  const ungroupedIds = useMemo(() => ungrouped.map((cert) => cert.id), [ungrouped]);
  const folderIds = useMemo(() => folders.map((folder) => folder.section.id), [folders]);
  const activeItem = activeId ? items.find((item) => item.id === activeId) : undefined;
  const draggingSection = activeItem?.kind === "section";
  const draggingCert = activeItem?.kind === "cert";
  const activeCert = draggingCert ? activeItem.cert : null;

  function baselineLayout() {
    return buildPersonnelCertificationLayout(certifications, sections);
  }

  function toggleCollapsed(sectionId: string) {
    setCollapsedIds((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  function folderIsCollapsed(sectionId: string, certs: PersonnelCertification[]) {
    if (editingId && certs.some((cert) => cert.id === editingId)) return false;
    return Boolean(collapsedIds[sectionId]);
  }

  function persistOrder(next: PersonnelCertificationLayoutItem[]) {
    setItems(next);
    setError(null);
    startTransition(async () => {
      try {
        await reorderPersonnelCertificationLayout({
          profileId,
          orderedItems: next.map((item) => ({ id: item.id, kind: item.kind })),
        });
        router.refresh();
      } catch (err) {
        setItems(baselineLayout());
        setError(err instanceof Error ? err.message : "Failed to save order");
      }
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragCancel() {
    setActiveId(null);
    setItems(baselineLayout());
  }

  function onDragOver(event: DragOverEvent) {
    if (!canOrganize || layoutLocked) return;
    const { active, over } = event;
    if (!over) return;
    const draggedId = String(active.id);
    const overId = String(over.id);
    if (draggedId === overId) return;

    const current = itemsRef.current;
    const dragged = current.find((item) => item.id === draggedId);
    if (dragged?.kind !== "cert") return;
    if (certificationLayoutContainerId(current, draggedId) === certificationLayoutContainerId(current, overId)) {
      return;
    }

    const next = movePersonnelCertificationLayout(current, draggedId, overId);
    if (certificationLayoutOrderKey(next) === certificationLayoutOrderKey(current)) return;
    itemsRef.current = next;
    setItems(next);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!canOrganize || layoutLocked) {
      setItems(baselineLayout());
      return;
    }
    const { active, over } = event;
    if (!over) {
      setItems(baselineLayout());
      return;
    }
    const current = itemsRef.current;
    const next = movePersonnelCertificationLayout(current, String(active.id), String(over.id));
    if (certificationLayoutOrderKey(next) === certificationLayoutOrderKey(baselineLayout())) return;
    persistOrder(next);
  }

  const empty = items.length === 0 && !adding && !addingSection;

  function renderCertRow(cert: PersonnelCertification) {
    if (editingId === cert.id) {
      return (
        <li key={cert.id} className="rounded-lg border p-4">
          <CertificationForm
            profileId={profileId}
            initial={cert}
            onDone={() => setEditingId(null)}
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }
    return (
      <CertificationCardRow
        key={cert.id}
        cert={cert}
        profileId={profileId}
        canManage={canManage}
        canOrganize={canOrganize}
        disabled={layoutLocked || draggingSection}
        onEdit={() => setEditingId(cert.id)}
      />
    );
  }

  const list = (
    <div className="space-y-3">
      {ungrouped.length > 0 ? (
        <SortableContext items={ungroupedIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3">{ungrouped.map((cert) => renderCertRow(cert))}</ul>
        </SortableContext>
      ) : null}
      {folders.length > 0 ? (
        <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3">
            {folders.map((folder) => {
              const collapsed = folderIsCollapsed(folder.section.id, folder.certs);
              return (
              <CertificationSectionFolder
                key={folder.section.id}
                item={{ kind: "section", id: folder.section.id, section: folder.section }}
                certCount={folder.certs.length}
                collapsed={collapsed}
                canOrganize={canOrganize}
                disabled={layoutLocked}
                draggingCert={Boolean(draggingCert)}
                onToggleCollapse={() => toggleCollapsed(folder.section.id)}
                onRename={(name) => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await updatePersonnelCertificationSection({
                        id: folder.section.id,
                        profileId,
                        name,
                      });
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to rename section");
                    }
                  });
                }}
                onDelete={() => {
                  if (!confirm("Remove this section? Certifications stay in the list.")) return;
                  setError(null);
                  startTransition(async () => {
                    try {
                      await deletePersonnelCertificationSection({
                        id: folder.section.id,
                        profileId,
                      });
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to remove section");
                    }
                  });
                }}
              >
                <SortableContext
                  items={folder.certs.map((cert) => cert.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {folder.certs.length === 0 ? (
                      <li className="pointer-events-none rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {canOrganize
                          ? "Drag certifications here."
                          : "No certifications in this section."}
                      </li>
                    ) : (
                      folder.certs.map((cert) => renderCertRow(cert))
                    )}
                  </ul>
                </SortableContext>
              </CertificationSectionFolder>
              );
            })}
          </ul>
        </SortableContext>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      {canOrganize ? (
        <p className="text-xs text-muted-foreground">
          Add sections to group certifications. Collapse a section to hide its certifications, or
          drag the section to move it with them.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canOrganize ? (
          addingSection ? (
            <form
              className="flex w-full min-w-0 flex-wrap items-end gap-2 rounded-lg border p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const name = sectionName.trim();
                if (!name) return;
                setError(null);
                startTransition(async () => {
                  try {
                    await createPersonnelCertificationSection({ profileId, name });
                    setSectionName("");
                    setAddingSection(false);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to add section");
                  }
                });
              }}
            >
              <div className="min-w-[12rem] flex-1 space-y-1">
                <FieldLabel htmlFor="cert-section-name">Section</FieldLabel>
                <Input
                  id="cert-section-name"
                  value={sectionName}
                  onChange={(event) => setSectionName(event.target.value)}
                  placeholder="Fire, EMS, Driver…"
                  autoFocus
                />
              </div>
              <Button type="submit" size="sm" disabled={pending || !sectionName.trim()}>
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setAddingSection(false);
                  setSectionName("");
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => setAddingSection(true)}
            >
              Add section
            </Button>
          )
        ) : null}
        {canManage ? (
          adding ? (
            <div className="w-full rounded-lg border p-4">
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

      {empty ? (
        <p className="text-sm text-muted-foreground">No certifications recorded.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={certificationCollision}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragCancel={onDragCancel}
          onDragEnd={onDragEnd}
        >
          {list}
          <DragOverlay dropAnimation={null}>
            {activeCert ? <CertificationDragPreview cert={activeCert} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {pending && canOrganize ? (
        <p className="text-xs text-muted-foreground">Saving layout…</p>
      ) : null}
    </div>
  );
}

function DragHandle({
  label,
  disabled,
  attributes,
  listeners,
}: {
  label: string;
  disabled?: boolean;
  attributes?: React.HTMLAttributes<HTMLButtonElement>;
  listeners?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className="flex shrink-0 cursor-grab touch-none items-center self-stretch rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      aria-label={`Reorder ${label}`}
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-5 w-5" />
    </button>
  );
}

function CertificationDragPreview({ cert }: { cert: PersonnelCertification }) {
  return (
    <div
      className={cn(
        "w-[min(36rem,calc(100vw-2rem))] cursor-grabbing rounded-lg border bg-background p-4 shadow-lg",
        isCertExpired(cert.expires_on) && "border-destructive/50 bg-destructive/5"
      )}
    >
      <p className="font-medium">{cert.name}</p>
      {cert.issuing_authority ? (
        <p className="text-sm text-muted-foreground">{cert.issuing_authority}</p>
      ) : null}
      <p className="mt-1 text-sm text-muted-foreground">
        {cert.issued_on ? `Issued ${formatDate(cert.issued_on)}` : "Issue date not recorded"}
        {cert.expires_on ? ` · Expires ${formatDate(cert.expires_on)}` : null}
      </p>
    </div>
  );
}

function CertificationSectionFolder({
  item,
  certCount,
  collapsed,
  canOrganize,
  disabled,
  draggingCert,
  onToggleCollapse,
  onRename,
  onDelete,
  children,
}: {
  item: Extract<PersonnelCertificationLayoutItem, { kind: "section" }>;
  certCount: number;
  collapsed: boolean;
  canOrganize: boolean;
  disabled?: boolean;
  draggingCert?: boolean;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const sortable = useSortable({
    id: item.id,
    animateLayoutChanges: () => false,
    disabled: {
      draggable: !canOrganize || Boolean(disabled) || Boolean(draggingCert),
      droppable: !canOrganize || Boolean(disabled),
    },
    data: { kind: "section" },
  });
  const style = {
    transform: draggingCert ? undefined : CSS.Transform.toString(sortable.transform),
    transition: draggingCert ? undefined : sortable.transition,
  };
  const FolderIcon = collapsed ? Folder : FolderOpen;

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      role="group"
      aria-label={`${item.section.name}, ${
        certCount === 1 ? "1 certification" : `${certCount} certifications`
      }`}
      className={cn(
        "space-y-2 rounded-lg border border-border bg-muted/30 p-2",
        sortable.isDragging && "z-10 bg-background opacity-90 shadow-md",
        draggingCert && sortable.isOver && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-md px-1 py-1">
        {canOrganize ? (
          <DragHandle
            label={`${item.section.name} and its certifications`}
            disabled={disabled}
            attributes={sortable.attributes}
            listeners={sortable.listeners}
          />
        ) : null}
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand section" : "Collapse section"}
          onClick={onToggleCollapse}
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")}
          />
          <FolderIcon className="h-4 w-4" aria-hidden />
        </button>
        {canOrganize ? (
          <Input
            defaultValue={item.section.name}
            disabled={disabled}
            className="min-w-[10rem] flex-1 font-semibold"
            aria-label="Section name"
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (!next || next === item.section.name) {
                event.target.value = item.section.name;
                return;
              }
              onRename(next);
            }}
          />
        ) : (
          <p
            className="min-w-0 flex-1 cursor-pointer font-semibold"
            onClick={onToggleCollapse}
          >
            {item.section.name}
          </p>
        )}
        <span className="text-xs text-muted-foreground">
          {certCount === 1 ? "1 certification" : `${certCount} certifications`}
        </span>
        {canOrganize ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={disabled}
            onClick={onDelete}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {collapsed ? null : children}
    </li>
  );
}

function CertificationCardRow({
  cert,
  profileId,
  canManage,
  canOrganize,
  disabled,
  onEdit,
}: {
  cert: PersonnelCertification;
  profileId: string;
  canManage: boolean;
  canOrganize: boolean;
  disabled?: boolean;
  onEdit: () => void;
}) {
  const sortable = useSortable({
    id: cert.id,
    animateLayoutChanges: () => false,
    disabled: !canOrganize || disabled,
    data: { kind: "cert" },
  });
  const style = {
    transform: sortable.isDragging ? undefined : CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-background p-4",
        isCertExpired(cert.expires_on) && "border-destructive/50 bg-destructive/5",
        sortable.isDragging && "opacity-40 shadow-none"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {canOrganize ? (
            <span className="pt-1">
              <DragHandle
                label={cert.name}
                disabled={disabled}
                attributes={sortable.attributes}
                listeners={sortable.listeners}
              />
            </span>
          ) : null}
          {cert.storage_path ? (
            <CertificationDownloadPreview
              id={cert.id}
              profileId={profileId}
              src={cert.preview_url ?? null}
              mimeType={cert.mime_type}
              fileName={cert.file_name}
            />
          ) : null}
          <div className="min-w-0">
            <p className="font-medium">{cert.name}</p>
            {cert.issuing_authority ? (
              <p className="text-sm text-muted-foreground">{cert.issuing_authority}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              {cert.issued_on ? `Issued ${formatDate(cert.issued_on)}` : "Issue date not recorded"}
              {cert.expires_on ? ` · Expires ${formatDate(cert.expires_on)}` : null}
              {isCertExpired(cert.expires_on) ? (
                <span className="ml-2 font-medium text-destructive">Expired</span>
              ) : null}
            </p>
            {cert.notes ? <p className="mt-2 text-sm">{cert.notes}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {cert.storage_path ? (
            <DownloadCertButton id={cert.id} profileId={profileId} previewUrl={cert.preview_url} />
          ) : null}
          {canManage ? (
            <>
              <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
                Edit
              </Button>
              <DeleteCertButton
                id={cert.id}
                profileId={profileId}
                storagePath={cert.storage_path}
              />
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function openCertificationFile(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function resolveCertificationUrl(input: {
  id: string;
  profileId: string;
  previewUrl?: string | null;
}) {
  if (input.previewUrl) return input.previewUrl;
  const { url } = await getPersonnelCertificationDownloadUrl({
    id: input.id,
    profileId: input.profileId,
  });
  return url;
}

function CertificationDownloadPreview({
  id,
  profileId,
  src,
  mimeType,
  fileName,
}: {
  id: string;
  profileId: string;
  src: string | null;
  mimeType: string | null;
  fileName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <CertificationFilePreview
      src={src}
      mimeType={mimeType}
      fileName={fileName}
      onOpen={() => {
        if (pending) return;
        startTransition(async () => {
          const url = await resolveCertificationUrl({ id, profileId, previewUrl: src });
          openCertificationFile(url);
        });
      }}
    />
  );
}

function DownloadCertButton({
  id,
  profileId,
  previewUrl,
}: {
  id: string;
  profileId: string;
  previewUrl?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const url = await resolveCertificationUrl({ id, profileId, previewUrl });
          openCertificationFile(url);
        });
      }}
    >
      {pending ? "…" : "Download"}
    </Button>
  );
}

function DeleteCertButton({
  id,
  profileId,
  storagePath,
}: {
  id: string;
  profileId: string;
  storagePath: string | null;
}) {
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
          await deletePersonnelCertification({ id, profileId, storagePath });
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function ClearableDateField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <FieldLabel htmlFor={id} className="mb-0">
          {label}
        </FieldLabel>
        {value ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
            onClick={() => {
              onChange("");
              setResetKey((key) => key + 1);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
      <Input
        key={`${id}-${resetKey}`}
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
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
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [issuingAuthority, setIssuingAuthority] = useState(initial?.issuing_authority ?? "");
  const [issuedOn, setIssuedOn] = useState(initial?.issued_on ?? "");
  const [expiresOn, setExpiresOn] = useState(initial?.expires_on ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [removeFile, setRemoveFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [convertingHeic, setConvertingHeic] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const selectedPreviewUrl = useObjectUrl(selectedFile);

  const existingFileName = initial?.file_name && !removeFile ? initial.file_name : null;
  const previewSrc = selectedPreviewUrl ?? (existingFileName ? initial?.preview_url ?? null : null);
  const previewMime = selectedFile?.type || (existingFileName ? initial?.mime_type ?? null : null);
  const previewName = selectedFile?.name ?? existingFileName;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const file = selectedFile;
        if (file && !isPersonnelDocumentFile(file)) {
          setError("Unsupported file type. Use PDF, image, or Word document.");
          return;
        }
        setError(null);
        startTransition(async () => {
          try {
            if (initial) {
              const { storagePath } = await updatePersonnelCertification({
                id: initial.id,
                profileId,
                name,
                issuingAuthority,
                issuedOn,
                expiresOn,
                notes,
                fileName: file?.name ?? null,
                mimeType: file?.type || null,
                removeFile: removeFile && !file,
              });
              if (file && storagePath) {
                const supabase = createSupabaseBrowserClient();
                const { error: uploadError } = await supabase.storage
                  .from(PERSONNEL_DOCUMENTS_BUCKET)
                  .upload(storagePath, file, {
                    upsert: true,
                    contentType: file.type || undefined,
                  });
                if (uploadError) throw new Error(uploadError.message);
              }
            } else {
              const { storagePath } = await createPersonnelCertification({
                profileId,
                name,
                issuingAuthority,
                issuedOn,
                expiresOn,
                notes,
                fileName: file?.name ?? null,
                mimeType: file?.type || null,
              });
              if (file && storagePath) {
                const supabase = createSupabaseBrowserClient();
                const { error: uploadError } = await supabase.storage
                  .from(PERSONNEL_DOCUMENTS_BUCKET)
                  .upload(storagePath, file, {
                    upsert: true,
                    contentType: file.type || undefined,
                  });
                if (uploadError) throw new Error(uploadError.message);
              }
            }
            onDone();
            router.refresh();
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
        <ClearableDateField
          id="cert-issued"
          label="Issued"
          value={issuedOn}
          onChange={setIssuedOn}
        />
        <ClearableDateField
          id="cert-expires"
          label="Expires"
          hint="Optional. Leave blank if it does not expire."
          value={expiresOn}
          onChange={setExpiresOn}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="cert-notes">Notes</FieldLabel>
        <Textarea id="cert-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="cert-file">
          {existingFileName ? "Replace file" : "Upload file"}
        </FieldLabel>
        {previewSrc || previewName ? (
          <div className="flex flex-wrap items-center gap-3">
            <CertificationFilePreview
              src={previewSrc}
              mimeType={previewMime}
              fileName={previewName}
            />
            {existingFileName && !selectedFile ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="text-destructive"
                  onClick={() => {
                    setRemoveFile(true);
                    setSelectedFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : selectedFile ? (
              <p className="text-sm text-muted-foreground">New file selected</p>
            ) : null}
          </div>
        ) : null}
        <input
          id="cert-file"
          ref={fileRef}
          type="file"
          accept={PERSONNEL_DOCUMENT_ACCEPT}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0] ?? null;
            if (!file) {
              setSelectedFile(null);
              return;
            }
            setError(null);
            setConvertingHeic(true);
            try {
              const next = await fileAsJpegIfHeic(file);
              setSelectedFile(next);
              setRemoveFile(false);
            } catch {
              setSelectedFile(null);
              if (fileRef.current) fileRef.current.value = "";
              setError("Could not read this HEIC image. Try exporting it as a JPEG.");
            } finally {
              setConvertingHeic(false);
            }
          }}
        />
        <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, WebP, HEIC, or Word. Optional.</p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || convertingHeic}>
          {pending ? "Saving…" : convertingHeic ? "Preparing image…" : initial ? "Save" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={pending || convertingHeic}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
