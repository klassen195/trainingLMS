import Link from "next/link";
import type { Program } from "@/lib/training-lms-types";
import { categoryLabel } from "@/lib/labels";
import { Card } from "@/components/ui/Card";

export function ProgramCard({
  program,
  progressPercent,
}: {
  program: Program;
  progressPercent?: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#C11B2B]">
            {categoryLabel(program.category)}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            <Link href={`/programs/${program.id}`} className="hover:underline">
              {program.title}
            </Link>
          </h2>
          {program.description ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{program.description}</p>
          ) : null}
        </div>
      </div>
      {typeof progressPercent === "number" ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{progressPercent}% complete</p>
      ) : null}
    </Card>
  );
}
