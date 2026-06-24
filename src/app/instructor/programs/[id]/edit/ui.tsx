"use client";

import { useState, useTransition } from "react";
import { addModule, updateModule, updateProgram } from "@/app/actions";
import { programCategories, categoryLabel } from "@/lib/labels";
import type { Module, Program, ProgramCategory, ProgramStatus } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function EditProgramForm({ program, modules }: { program: Program; modules: Module[] }) {
  const [title, setTitle] = useState(program.title);
  const [description, setDescription] = useState(program.description ?? "");
  const [category, setCategory] = useState<ProgramCategory>(program.category);
  const [status, setStatus] = useState<ProgramStatus>(program.status);
  const [pending, startTransition] = useTransition();

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleContent, setNewModuleContent] = useState("");

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
        <ul className="space-y-4">
          {modules.map((moduleItem) => (
            <ModuleEditor key={moduleItem.id} programId={program.id} moduleItem={moduleItem} />
          ))}
        </ul>
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
            });
          }}
        >
          <h3 className="text-sm font-medium">Add module</h3>
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
            Add module
          </Button>
        </form>
      </section>
    </div>
  );
}

function ModuleEditor({ programId, moduleItem }: { programId: string; moduleItem: Module }) {
  const [title, setTitle] = useState(moduleItem.title);
  const [content, setContent] = useState(moduleItem.content);
  const [sortOrder, setSortOrder] = useState(String(moduleItem.sort_order));
  const [pending, startTransition] = useTransition();

  return (
    <li className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      />
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
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
    </li>
  );
}
