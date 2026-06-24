import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

export function ModulePageNav({
  programId,
  prevModuleId,
  nextModuleId,
  className,
}: {
  programId: string;
  prevModuleId: string | null;
  nextModuleId: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {prevModuleId ? (
        <Button variant="outline" asChild>
          <Link href={`/programs/${programId}/modules/${prevModuleId}`}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Link>
        </Button>
      ) : (
        <div />
      )}
      <Button variant="ghost" asChild>
        <Link href={`/programs/${programId}`}>Back to program</Link>
      </Button>
      {nextModuleId ? (
        <Button asChild>
          <Link href={`/programs/${programId}/modules/${nextModuleId}`}>
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <div />
      )}
    </div>
  );
}
