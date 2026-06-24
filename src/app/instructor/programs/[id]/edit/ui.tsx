"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addModule,
  linkModuleToProgram,
  unlinkModuleFromProgram,
  updateModule,
  updateProgram,
  updateProgramModuleOrder,
} from "@/app/actions";
import { programCategories, categoryLabel } from "@/lib/labels";
import type { Module, ModuleResource, Program, ProgramCategory, ProgramModuleEntry, ProgramStatus } from "@/lib/training-lms-types";
import { ModuleResourcesEditor } from "@/components/ModuleResourcesEditor";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function EditProgramForm({
  program,
  modules,
  linkableModules,
  editableModuleIds,
  resourcesByModuleId,
}: {
  program: Program;
  modules: ProgramModuleEntry[];
  linkableModules: Module[];
  editableModuleIds: Set<string>;
  resourcesByModuleId: Record<string, ModuleResource[]>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(program.title);
  const [description, setDescription] = useState(program.description ?? "");
  const [category, setCategory] = useState<ProgramCategory>(program.category);
  const [status, setStatus] = useState<ProgramStatus>(program.status);
  const [pending, startTransition] = useTransition();

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleContent, setNewModuleContent] = useState("");
  const [linkModuleId, setLinkModuleId] = useState("");

  return (
    <div className="space-y-10">
      <form
        className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => updateProgram({ id: program.id, title, description, category, status }));
        }}
      >
        <h2 className="text-lg font-semibold">Program details</h2>
        <div className="space-y-2">
          <FieldLabel htmlFor="edit-title">Title</FieldLabel>
          <Input id="edit-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="edit-description">Description</FieldLabel>
          <textarea
            id="edit-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="edit-category">Category</FieldLabel>
            <select
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProgramCategory)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {programCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="edit-status">Status</FieldLabel>
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProgramStatus)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <Button type="submit" variant="primary" disabled={pending} className="bg-[#0B2E4B] text-white">
          {pending ? "Saving..." : "Save program"}
        </Button>
      </form>

      <section className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Modules</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Modules can be shared across programs. Removing a module from this program does not delete it.
        </p>
        <ul className="space-y-4">
          {modules.map((moduleItem) => (
            <ModuleEditor
              key={moduleItem.id}
              programId={program.id}
              moduleItem={moduleItem}
              canEdit={editableModuleIds.has(moduleItem.id)}
              resources={resourcesByModuleId[moduleItem.id] ?? []}
              onUnlinked={() => router.refresh()}
            />
          ))}
        </ul>

        {linkableModules.length ? (
          <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 className="text-sm font-medium">Link existing module</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1 space-y-2">
                <FieldLabel htmlFor="link-module">Module</FieldLabel>
                <select
                  id="link-module"
                  value={linkModuleId}
                  onChange={(e) => setLinkModuleId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="">Select a module</option>
                  {linkableModules.map((moduleItem) => (
                    <option key={moduleItem.id} value={moduleItem.id}>
                      {moduleItem.title}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={pending || !linkModuleId}
                onClick={() =>
                  startTransition(async () => {
                    await linkModuleToProgram({
                      programId: program.id,
                      moduleId: linkModuleId,
                      sortOrder: modules.length + 1,
                    });
                    setLinkModuleId("");
                    router.refresh();
                  })
                }
              >
                Link module
              </Button>
            </div>
          </div>
        ) : null}

        <form
          className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await addModule({
                programId: program.id,
                title: newModuleTitle,
                content: newModuleContent,
                sortOrder: modules.length + 1,
              });
              setNewModuleTitle("");
              setNewModuleContent("");
              router.refresh();
            });
          }}
        >
          <h3 className="text-sm font-medium">Create new module</h3>
          <Input
            placeholder="Module title"
            required
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
          />
          <textarea
            placeholder="Module content"
            required
            rows={3}
            value={newModuleContent}
            onChange={(e) => setNewModuleContent(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
          <Button type="submit" disabled={pending}>
            Create and add module
          </Button>
        </form>
      </section>
    </div>
  );
}

function ModuleEditor({
  programId,
  moduleItem,
  canEdit,
  resources,
  onUnlinked,
}: {
  programId: string;
  moduleItem: ProgramModuleEntry;
  canEdit: boolean;
  resources: ModuleResource[];
  onUnlinked: () => void;
}) {
  const [title, setTitle] = useState(moduleItem.title);
  const [content, setContent] = useState(moduleItem.content);
  const [sortOrder, setSortOrder] = useState(String(moduleItem.sort_order));
  const [pending, startTransition] = useTransition();

  return (
    <li className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
      {canEdit ? (
        <>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </>
      ) : (
        <>
          <p className="font-medium">{moduleItem.title}</p>
          <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{moduleItem.content}</p>
          <p className="text-xs text-zinc-500">Shared module — only the creator can edit content.</p>
        </>
      )}
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                updateModule({
                  programId,
                  moduleId: moduleItem.id,
                  title,
                  content,
                  sortOrder: Number(sortOrder) || 0,
                })
              )
            }
          >
            Save module
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                updateProgramModuleOrder({
                  programId,
                  moduleId: moduleItem.id,
                  sortOrder: Number(sortOrder) || 0,
                })
              )
            }
          >
            Save order
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await unlinkModuleFromProgram({ programId, moduleId: moduleItem.id });
              onUnlinked();
            })
          }
        >
          Remove from program
        </Button>
      </div>
      {canEdit ? (
        <ModuleResourcesEditor programId={programId} moduleId={moduleItem.id} resources={resources} />
      ) : null}
    </li>
  );
}
