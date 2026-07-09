import { EnrollInProgramButton } from "@/components/EnrollInProgramButton";

export function ProgramEnrollmentPanel({
  programId,
  moduleCount,
  enrolledCount,
}: {
  programId: string;
  moduleCount: number;
  enrolledCount: number;
}) {
  const fullyEnrolled = moduleCount > 0 && enrolledCount >= moduleCount;
  if (fullyEnrolled) return null;

  const partiallyEnrolled = enrolledCount > 0;

  return (
    <div className="mb-8 rounded-lg border border-dashed bg-muted/30 p-4">
      <p className="mb-3 text-sm text-muted-foreground">
        {partiallyEnrolled
          ? `You're enrolled in ${enrolledCount} of ${moduleCount} modules. Enroll in the full program to track progress across every module, or open a module below to enroll individually.`
          : "Enroll in the full program to track progress across all modules, or open a module below to enroll in just that module."}
      </p>
      <EnrollInProgramButton
        programId={programId}
        label={partiallyEnrolled ? "Enroll in all modules" : "Enroll in program"}
      />
    </div>
  );
}
