"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  isCertExpired,
  isPersonnelDocumentFile,
  PERSONNEL_DOCUMENT_ACCEPT,
  PERSONNEL_DOCUMENTS_BUCKET,
} from "@/lib/personnel-types";
import { Button } from "@/components/ui/Button";
import { FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";

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

  useEffect(() => {
    setItems(buildPersonnelCertificationLayout(certifications, sections));
  }, [certifications, sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const layoutLocked = Boolean(editingId) || adding || pending;

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
        setItems(buildPersonnelCertificationLayout(certifications, sections));
        setError(err instanceof Error ? err.message : "Failed to save order");
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    if (!canOrganize || layoutLocked) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    persistOrder(arrayMove(items, oldIndex, newIndex));
  }

  const empty = items.length === 0 && !adding && !addingSection;

  const list = (
    <ul className="space-y-3">
      {items.map((item) =>
        item.kind === "section" ? (
          <CertificationSectionRow
            key={item.id}
            item={item}
            canOrganize={canOrganize}
            disabled={layoutLocked}
            onRename={(name) => {
              setError(null);
              startTransition(async () => {
                try {
                  await updatePersonnelCertificationSection({
                    id: item.id,
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
              if (!confirm("Remove this section break? Certifications stay in the list.")) return;
              setError(null);
              startTransition(async () => {
                try {
                  await deletePersonnelCertificationSection({ id: item.id, profileId });
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to remove section");
                }
              });
            }}
          />
        ) : editingId === item.cert.id ? (
          <li key={item.id} className="rounded-lg border p-4">
            <CertificationForm
              profileId={profileId}
              initial={item.cert}
              onDone={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          </li>
        ) : (
          <CertificationCardRow
            key={item.id}
            cert={item.cert}
            profileId={profileId}
            canManage={canManage}
            canOrganize={canOrganize}
            disabled={layoutLocked}
            onEdit={() => setEditingId(item.cert.id)}
          />
        )
      )}
    </ul>
  );

  return (
    <div className="space-y-4">
      {canOrganize ? (
        <p className="text-xs text-muted-foreground">
          Add section breaks, then drag certifications into the order that makes sense for you.
        </p>
      ) : null}

      {empty ? (
        <p className="text-sm text-muted-foreground">No certifications recorded.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {pending && canOrganize ? (
        <p className="text-xs text-muted-foreground">Saving layout…</p>
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
                <FieldLabel htmlFor="cert-section-name">Section break</FieldLabel>
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
              Add section break
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

function CertificationSectionRow({
  item,
  canOrganize,
  disabled,
  onRename,
  onDelete,
}: {
  item: Extract<PersonnelCertificationLayoutItem, { kind: "section" }>;
  canOrganize: boolean;
  disabled?: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const sortable = useSortable({ id: item.id, disabled: !canOrganize || disabled });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2",
        sortable.isDragging && "z-10 bg-background opacity-90 shadow-md"
      )}
    >
      {canOrganize ? (
        <DragHandle
          label={item.section.name}
          disabled={disabled}
          attributes={sortable.attributes}
          listeners={sortable.listeners}
        />
      ) : null}
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
        <p className="min-w-0 flex-1 font-semibold">{item.section.name}</p>
      )}
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
  const sortable = useSortable({ id: cert.id, disabled: !canOrganize || disabled });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border p-4",
        isCertExpired(cert.expires_on) && "border-destructive/50 bg-destructive/5",
        sortable.isDragging && "z-10 bg-background opacity-90 shadow-md"
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
