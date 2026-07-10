"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addModule, linkModuleToProgram, updateProgram } from "@/app/actions";
import { programTags, tagLabel } from "@/lib/labels";
import type { Module, Program, ProgramModuleEntry, ProgramStatus, ProgramTag } from "@/lib/training-lms-types";
import { ProgramModuleSortableList } from "@/components/ProgramModuleSortableList";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function EditProgramForm({
  program,
  modules,
  linkableModules,
  editableModuleIds,
}: {
  program: Program;
  modules: ProgramModuleEntry[];
  linkableModules: Module[];
  editableModuleIds: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(program.title);
  const [description, setDescription] = useState(program.description ?? "");
  const [tags, setTags] = useState<ProgramTag[]>(program.tags);
  const [status, setStatus] = useState<ProgramStatus>(program.status);
  const [pending, startTransition] = useTransition();

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [linkModuleId, setLinkModuleId] = useState("");

  function toggleTag(tag: ProgramTag) {
    setTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Program details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (tags.length === 0) return;
              startTransition(() => updateProgram({ id: program.id, title, description, tags, status }));
            }}
          >
            <div className="space-y-2">
              <FieldLabel htmlFor="edit-title">Title</FieldLabel>
              <Input id="edit-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="edit-description">Description</FieldLabel>
              <Textarea
                id="edit-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="block text-sm font-medium text-foreground">Tags</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {programTags.map((tag) => (
                  <label key={tag} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={tags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                      className="h-4 w-4 rounded border-input"
                    />
                    {tagLabel(tag)}
                  </label>
                ))}
              </div>
              {tags.length === 0 ? (
                <p className="text-sm text-destructive">Select at least one tag.</p>
              ) : null}
            </fieldset>
            <div className="space-y-2">
              <FieldLabel htmlFor="edit-status">Status</FieldLabel>
              <Select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as ProgramStatus)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
            <Button type="submit" disabled={pending || tags.length === 0}>
              {pending ? "Saving..." : "Save program"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>
            Drag to reorder modules, or click a module to edit its content and resources.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgramModuleSortableList
            programId={program.id}
            modules={modules}
            editableModuleIds={editableModuleIds}
          />

          {linkableModules.length ? (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-medium">Link existing module</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[16rem] flex-1 space-y-2">
                  <FieldLabel htmlFor="link-module">Module</FieldLabel>
                  <Select id="link-module" value={linkModuleId} onChange={(e) => setLinkModuleId(e.target.value)}>
                    <option value="">Select a module</option>
                    {linkableModules.map((moduleItem) => (
                      <option key={moduleItem.id} value={moduleItem.id}>
                        {moduleItem.title}
                      </option>
                    ))}
                  </Select>
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
            className="space-y-3 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const moduleId = await addModule({
                  programId: program.id,
                  title: newModuleTitle,
                  content: "",
                  sortOrder: modules.length + 1,
                });
                setNewModuleTitle("");
                router.push(`/instructor/programs/${program.id}/modules/${moduleId}/edit`);
              });
            }}
          >
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Plus className="h-4 w-4" />
              Create new module
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1 space-y-2">
                <FieldLabel htmlFor="new-module-title">Title</FieldLabel>
                <Input
                  id="new-module-title"
                  placeholder="Module title"
                  required
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={pending || !newModuleTitle.trim()}>
                Create module
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
