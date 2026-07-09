import { UnenrollFromModuleButton } from "@/components/UnenrollFromModuleButton";

export function ModuleUnenrollmentPanel({
  programId,
  moduleId,
}: {
  programId: string;
  moduleId: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
      <p className="text-sm text-muted-foreground">You're enrolled in this module.</p>
      <UnenrollFromModuleButton programId={programId} moduleId={moduleId} />
    </div>
  );
}
