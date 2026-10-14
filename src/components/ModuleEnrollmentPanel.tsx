import { EnrollInModuleButton } from "@/components/EnrollInModuleButton";

export function ModuleEnrollmentPanel({
  programId,
  moduleId,
}: {
  programId: string;
  moduleId: string;
}) {
  return (
    <div className="mb-6 rounded-lg border border-dashed bg-muted/30 p-4">
      <p className="mb-3 text-sm text-muted-foreground">
        You can browse this course without enrolling. Enroll here to track progress for this course only, or enroll
        in the full module from the module page to track every course.
      </p>
      <EnrollInModuleButton programId={programId} moduleId={moduleId} />
    </div>
  );
}
