"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addModuleResourceYoutube, deleteModuleResource, prepareModuleResourceUpload } from "@/app/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  detectResourceType,
  MODULE_RESOURCE_ACCEPT,
  resourceSubtitle,
  resourceTypeLabel,
} from "@/lib/module-resources";
import type { ModuleResource } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function ModuleResourcesEditor({
  programId,
  moduleId,
  resources,
}: {
  programId: string;
  moduleId: string;
  resources: ModuleResource[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
      <h4 className="text-sm font-medium text-[#0B2E4B]">Resources</h4>

      {resources.length ? (
        <ul className="space-y-2">
          {resources.map((resource) => (
            <li
              key={resource.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <div>
                <p className="font-medium">{resource.title}</p>
                <p className="text-xs text-zinc-500">
                  {resourceTypeLabel(resource.resource_type)} · {resourceSubtitle(resource)}
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
                      setError(err instanceof Error ? err.message : "Failed to remove resource");
                    }
                  })
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">No videos, PDFs, PowerPoints, or YouTube links yet.</p>
      )}

      <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Upload file</p>
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
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0B2E4B] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0B2E4B]/90"
          />
          <p className="text-xs text-zinc-500">Supported: MP4, WebM, MOV, PDF, PPT, PPTX (max 500 MB)</p>
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

      <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">YouTube link</p>
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

      {error ? <p className="text-xs text-[#C11B2B]">{error}</p> : null}
    </div>
  );
}
