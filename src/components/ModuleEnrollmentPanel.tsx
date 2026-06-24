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
        You can browse this module without enrolling. Enroll to track your progress and mark items complete.
      </p>
      <EnrollInModuleButton programId={programId} moduleId={moduleId} />
    </div>
  );
}
