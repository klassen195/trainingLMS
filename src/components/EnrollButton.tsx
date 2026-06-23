"use client";

import { useTransition } from "react";
import { enrollInCourse } from "@/app/actions";
import { Button } from "@/components/ui/Button";

export function EnrollButton({ courseId }: { courseId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() => startTransition(() => enrollInCourse(courseId))}
      className="bg-[#C11B2B] text-white hover:bg-[#a01624] dark:bg-[#C11B2B] dark:text-white"
    >
      {pending ? "Enrolling..." : "Enroll"}
    </Button>
  );
}
