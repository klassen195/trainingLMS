import { requireUserProfile } from "@/lib/auth";
import { getProfileCapabilities } from "@/lib/capability-access";
import { getModulePageContext } from "@/lib/module-page-data";
import { ModuleBreadcrumbNav } from "@/components/ModuleBreadcrumbNav";
import { ModuleEnrollmentPanel } from "@/components/ModuleEnrollmentPanel";
import { ModuleUnenrollmentPanel } from "@/components/ModuleUnenrollmentPanel";
import { ModuleResourceSidebar } from "@/components/ModuleResourceSidebar";

export default async function ModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const profile = await requireUserProfile();
  const caps = await getProfileCapabilities(profile);
  const { id, moduleId } = await params;
  const ctx = await getModulePageContext(id, moduleId, profile);

  return (
    <>
      <ModuleBreadcrumbNav
        programId={id}
        programTitle={ctx.program.title}
        moduleId={moduleId}
        moduleTitle={ctx.module.title}
        resources={ctx.resources}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-64">
            <ModuleResourceSidebar
              programId={id}
              moduleId={moduleId}
              moduleTitle={ctx.module.title}
              resources={ctx.resources}
              enrolled={ctx.enrolled}
              completedResourceIds={ctx.completedResourceIds}
            />
          </aside>
          <div className="min-w-0 flex-1">
            {!caps.self_enroll ? (
              !ctx.enrolled ? (
                <div className="mb-6 rounded-lg border p-4 text-sm text-muted-foreground">
                  You need to be enrolled in this module by an instructor or admin to track progress.
                </div>
              ) : null
            ) : !ctx.enrolled ? (
              <ModuleEnrollmentPanel programId={id} moduleId={moduleId} />
            ) : (
              <ModuleUnenrollmentPanel programId={id} moduleId={moduleId} />
            )}
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
