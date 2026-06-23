"use client";

import { useState, useTransition } from "react";
import { submitAssignment } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/Field";

export function AssignmentSubmitForm({
  courseId,
  assignmentId,
  initialContent,
}: {
  courseId: string;
  assignmentId: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => submitAssignment({ courseId, assignmentId, content }));
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="assignment-response">Your response</FieldLabel>
        <textarea
          id="assignment-response"
          required
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        className="bg-[#0B2E4B] text-white dark:bg-[#0B2E4B] dark:text-white"
      >
        {pending ? "Submitting..." : "Submit assignment"}
      </Button>
    </form>
  );
}
