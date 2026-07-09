import { UnenrollFromProgramButton } from "@/components/UnenrollFromProgramButton";

export function ProgramUnenrollmentPanel({
  programId,
  enrolledCount,
  moduleCount,
}: {
  programId: string;
  enrolledCount: number;
  moduleCount: number;
}) {
  if (enrolledCount === 0) return null;

  const fullyEnrolled = moduleCount > 0 && enrolledCount >= moduleCount;

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {fullyEnrolled
          ? "You're enrolled in all modules in this program."
          : `You're enrolled in ${enrolledCount} of ${moduleCount} modules.`}
      </p>
      <UnenrollFromProgramButton programId={programId} enrolledCount={enrolledCount} />
    </div>
  );
}
