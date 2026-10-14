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
          ? `You're enrolled in ${enrolledCount} of ${moduleCount} courses. Enroll in the full module to track progress across every course, or open a course below to enroll individually.`
          : "Enroll in the full module to track progress across all courses, or open a course below to enroll in just that course."}
      </p>
      <EnrollInProgramButton
        programId={programId}
        label={partiallyEnrolled ? "Enroll in all courses" : "Enroll in module"}
      />
    </div>
  );
}
