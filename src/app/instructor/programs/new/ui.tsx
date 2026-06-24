"use client";

import { useState, useTransition } from "react";
import { createProgram } from "@/app/actions";
import { programCategories, categoryLabel } from "@/lib/labels";
import type { ProgramCategory, ProgramStatus } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function NewProgramForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProgramCategory>("fire");
  const [status, setStatus] = useState<ProgramStatus>("draft");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => createProgram({ title, description, category, status }));
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="title">Title</FieldLabel>
        <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="category">Category</FieldLabel>
        <select
          id="category"
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
        <FieldLabel htmlFor="status">Status</FieldLabel>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProgramStatus)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <Button type="submit" variant="primary" disabled={pending} className="bg-[#C11B2B] text-white">
        {pending ? "Creating..." : "Create program"}
      </Button>
    </form>
  );
}
