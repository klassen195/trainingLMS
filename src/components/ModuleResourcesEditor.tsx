"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addModuleResourceChecklist,
  addModuleResourceLink,
  addModuleResourceQuiz,
  addModuleResourceYoutube,
  deleteModuleResource,
  prepareModuleResourceUpload,
} from "@/app/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  detectResourceType,
  MODULE_RESOURCE_ACCEPT,
  partitionModuleResources,
  resourceSubtitle,
  resourceTypeLabel,
} from "@/lib/module-resources";
import type { ChecklistItem, ModuleResource } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { ChecklistItemsEditor } from "@/components/ChecklistItemsEditor";
import { LinkResourceEditor } from "@/components/LinkResourceEditor";
import { ModuleResourceSortableList } from "@/components/ModuleResourceSortableList";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";

const addResourceSectionClassName =
  "space-y-3 rounded-lg border border-dashed border-border bg-muted/20 p-4";

export function ModuleResourcesEditor({
  programId,
  moduleId,
  resources,
  checklistItemsByResourceId = {},
  isAdmin = false,
}: {
  programId: string;
  moduleId: string;
  resources: ModuleResource[];
  checklistItemsByResourceId?: Record<string, ChecklistItem[]>;
  isAdmin?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [checklistTitle, setChecklistTitle] = useState("");
  const [checklistItemsText, setChecklistItemsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { linkedResources, checklists: checklistResources } = partitionModuleResources(resources);

  return (
    <div className="space-y-6 border-t border-border pt-4">
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">Resources</h4>

        {linkedResources.length ? (
          <ModuleResourceSortableList
            programId={programId}
            moduleId={moduleId}
            allResources={resources}
            items={linkedResources}
            group="linked"
            renderItem={(resource) => (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    {resource.resource_type === "link" ? (
                      <p className="text-xs text-muted-foreground">{resourceTypeLabel(resource.resource_type)}</p>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">{resource.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {resourceTypeLabel(resource.resource_type)} · {resourceSubtitle(resource)}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resource.resource_type === "quiz" && isAdmin ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/quizzes/${resource.id}/edit`}>Configure quiz</Link>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          setError(null);
                          try {
                            await deleteModuleResource({
                              programId,
                              moduleId,
                              resourceId: resource.id,
                              storagePath: resource.storage_path,
                            });
                            router.refresh();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to remove resource");
                          }
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {resource.resource_type === "link" ? (
                  <LinkResourceEditor
                    programId={programId}
                    moduleId={moduleId}
                    resourceId={resource.id}
                    title={resource.title}
                    url={resource.external_url ?? ""}
                  />
                ) : null}
              </>
            )}
          />
        ) : (
        <p className="text-xs text-muted-foreground">
          No videos, PDFs, PowerPoints, YouTube links, website links, or quizzes yet.
        </p>
      )}

      <div className={addResourceSectionClassName}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upload file</p>
        <div className="space-y-2">
          <FieldLabel htmlFor={`resource-title-${moduleId}`}>Resource title</FieldLabel>
          <Input
            id={`resource-title-${moduleId}`}
            placeholder="e.g. Pump operations overview"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor={`resource-file-${moduleId}`}>File</FieldLabel>
          <input
            ref={fileInputRef}
            id={`resource-file-${moduleId}`}
            type="file"
            accept={MODULE_RESOURCE_ACCEPT}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          <p className="text-xs text-muted-foreground">Supported: MP4, WebM, MOV, PDF, PPT, PPTX (max 500 MB)</p>
        </div>
        <Button
          size="sm"
          disabled={pending || !title.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const file = fileInputRef.current?.files?.[0];
              if (!file) {
                setError("Choose a file to upload.");
                return;
              }

              const resourceType = detectResourceType(file);
              if (!resourceType) {
                setError("Unsupported file type. Use video, PDF, or PowerPoint.");
                return;
              }

              let uploadInfo: { resourceId: string; storagePath: string } | null = null;
              try {
                uploadInfo = await prepareModuleResourceUpload({
                  programId,
                  moduleId,
                  title: title.trim(),
                  resourceType,
                  fileName: file.name,
                  sortOrder: resources.length + 1,
                });

                const supabase = createSupabaseBrowserClient();
                const { error: uploadError } = await supabase.storage
                  .from("module-resources")
                  .upload(uploadInfo.storagePath, file, { upsert: false });

                if (uploadError) {
                  await deleteModuleResource({
                    programId,
                    moduleId,
                    resourceId: uploadInfo.resourceId,
                    storagePath: uploadInfo.storagePath,
                  });
                  throw uploadError;
                }

                setTitle("");
                if (fileInputRef.current) fileInputRef.current.value = "";
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to upload resource");
              }
            })
          }
        >
          {pending ? "Uploading..." : "Add file"}
        </Button>
      </div>

      <div className={addResourceSectionClassName}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">YouTube link</p>
        <div className="space-y-2">
          <FieldLabel htmlFor={`youtube-title-${moduleId}`}>Video title</FieldLabel>
          <Input
            id={`youtube-title-${moduleId}`}
            placeholder="e.g. Engine pump training"
            value={youtubeTitle}
            onChange={(e) => setYoutubeTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor={`youtube-url-${moduleId}`}>YouTube URL</FieldLabel>
          <Input
            id={`youtube-url-${moduleId}`}
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={pending || !youtubeTitle.trim() || !youtubeUrl.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await addModuleResourceYoutube({
                  programId,
                  moduleId,
                  title: youtubeTitle.trim(),
                  youtubeUrl: youtubeUrl.trim(),
                  sortOrder: resources.length + 1,
                });
                setYoutubeTitle("");
                setYoutubeUrl("");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to add YouTube video");
              }
            })
          }
        >
          {pending ? "Adding..." : "Add YouTube video"}
        </Button>
      </div>

      <div className={addResourceSectionClassName}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Website link</p>
        <div className="space-y-2">
          <FieldLabel htmlFor={`link-title-${moduleId}`}>Link title</FieldLabel>
          <Input
            id={`link-title-${moduleId}`}
            placeholder="e.g. NFPA 1001 reference"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor={`link-url-${moduleId}`}>Website URL</FieldLabel>
          <Input
            id={`link-url-${moduleId}`}
            type="url"
            placeholder="https://example.com/resource"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={pending || !linkTitle.trim() || !linkUrl.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await addModuleResourceLink({
                  programId,
                  moduleId,
                  title: linkTitle.trim(),
                  url: linkUrl.trim(),
                  sortOrder: resources.length + 1,
                });
                setLinkTitle("");
                setLinkUrl("");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to add website link");
              }
            })
          }
        >
          {pending ? "Adding..." : "Add website link"}
        </Button>
      </div>

      <div className={addResourceSectionClassName}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quiz</p>
        <div className="space-y-2">
          <FieldLabel htmlFor={`quiz-title-${moduleId}`}>Quiz title</FieldLabel>
          <Input
            id={`quiz-title-${moduleId}`}
            placeholder="e.g. Module knowledge check"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Creates a quiz resource. An admin configures the question pool and pass rules.
        </p>
        <Button
          size="sm"
          disabled={pending || !quizTitle.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await addModuleResourceQuiz({
                  programId,
                  moduleId,
                  title: quizTitle.trim(),
                  sortOrder: resources.length + 1,
                });
                setQuizTitle("");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to add quiz");
              }
            })
          }
        >
          {pending ? "Adding..." : "Add quiz"}
        </Button>
      </div>
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <h4 className="text-sm font-medium text-foreground">Checklists</h4>
        <p className="text-xs text-muted-foreground">
          Checklists appear on the module page below resources. Learners can check items off directly there.
        </p>

        {checklistResources.length ? (
          <ModuleResourceSortableList
            programId={programId}
            moduleId={moduleId}
            allResources={resources}
            items={checklistResources}
            group="checklist"
            renderItem={(resource) => (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{resource.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {(checklistItemsByResourceId[resource.id] ?? []).length} item(s)
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        setError(null);
                        try {
                          await deleteModuleResource({
                            programId,
                            moduleId,
                            resourceId: resource.id,
                            storagePath: resource.storage_path,
                          });
                          router.refresh();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Failed to remove checklist");
                        }
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
                <ChecklistItemsEditor
                  programId={programId}
                  moduleId={moduleId}
                  resourceId={resource.id}
                  items={checklistItemsByResourceId[resource.id] ?? []}
                />
              </>
            )}
          />
        ) : (
          <p className="text-xs text-muted-foreground">No checklists yet.</p>
        )}

      <div className={addResourceSectionClassName}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Add checklist</p>
        <div className="space-y-2">
          <FieldLabel htmlFor={`checklist-title-${moduleId}`}>Checklist title</FieldLabel>
          <Input
            id={`checklist-title-${moduleId}`}
            placeholder="e.g. Pre-shift equipment check"
            value={checklistTitle}
            onChange={(e) => setChecklistTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor={`checklist-items-${moduleId}`}>Items</FieldLabel>
          <Textarea
            id={`checklist-items-${moduleId}`}
            rows={4}
            placeholder={"Enter one item per line\nInspect hose\nCheck SCBA\nReview run card"}
            value={checklistItemsText}
            onChange={(e) => setChecklistItemsText(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={pending || !checklistTitle.trim() || !checklistItemsText.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await addModuleResourceChecklist({
                  programId,
                  moduleId,
                  title: checklistTitle.trim(),
                  items: checklistItemsText.split("\n"),
                  sortOrder: resources.length + 1,
                });
                setChecklistTitle("");
                setChecklistItemsText("");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to add checklist");
              }
            })
          }
        >
          {pending ? "Adding..." : "Add checklist"}
        </Button>
      </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
