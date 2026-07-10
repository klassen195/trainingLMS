"use client";

import { useState, useTransition } from "react";
import { createProgram } from "@/app/actions";
import { programTags, tagLabel } from "@/lib/labels";
import type { ProgramStatus, ProgramTag } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function NewProgramForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<ProgramTag[]>(["fire"]);
  const [status, setStatus] = useState<ProgramStatus>("draft");
  const [pending, startTransition] = useTransition();

  function toggleTag(tag: ProgramTag) {
    setTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (tags.length === 0) return;
        startTransition(() => createProgram({ title, description, tags, status }));
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="title">Title</FieldLabel>
        <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea
          id="description"
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
        <FieldLabel htmlFor="status">Status</FieldLabel>
        <Select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProgramStatus)}
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </Select>
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={pending || tags.length === 0}
        className="bg-[#C11B2B] text-white"
      >
        {pending ? "Creating..." : "Create program"}
      </Button>
    </form>
  );
}
