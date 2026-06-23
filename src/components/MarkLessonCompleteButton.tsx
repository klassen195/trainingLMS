"use client";

import { useTransition } from "react";
import { markLessonComplete } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function MarkLessonCompleteButton({
  courseId,
  lessonId,
  completed,
}: {
  courseId: string;
  lessonId: string;
  completed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (completed) {
    return <p className="text-sm font-medium text-green-700">Lesson completed</p>;
  }

  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() => startTransition(() => markLessonComplete({ courseId, lessonId }))}
      className="bg-[#0B2E4B] text-white hover:bg-[#082238] dark:bg-[#0B2E4B] dark:text-white"
    >
      {pending ? "Saving..." : "Mark complete"}
    </Button>
  );
}
