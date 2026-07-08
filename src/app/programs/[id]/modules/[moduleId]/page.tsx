import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getModulePageContext } from "@/lib/module-page-data";
import { loadModuleChecklistsWithProgress } from "@/lib/checklist-data";
import { loadUserHighlightIds } from "@/lib/user-highlights";
import { partitionModuleResources } from "@/lib/module-resources";
import { HighlightStarButton } from "@/components/HighlightStarButton";
import { ModuleChecklistsSection } from "@/components/ModuleChecklistsSection";
import { ModulePageNav } from "@/components/ModulePageNav";
import { ModuleResourceList } from "@/components/ModuleResourceList";
import { MarkModuleCompleteButton } from "@/components/MarkModuleCompleteButton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function ModulePage({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
  const profile = await requireUserProfile();
  const { id, moduleId } = await params;
  const supabase = await createSupabaseServerClient();
  const ctx = await getModulePageContext(id, moduleId, profile);
  const { moduleIds: highlightedModuleIds } = await loadUserHighlightIds(supabase, profile.id);
  const { linkedResources, checklists: checklistResources } = partitionModuleResources(ctx.resources);
  const checklists = await loadModuleChecklistsWithProgress(
    supabase,
    checklistResources,
    profile.id,
    ctx.completedResourceIds
  );

  return (
    <>
      <ModulePageNav
        programId={id}
        prevModuleId={ctx.prevModuleId}
        nextModuleId={ctx.nextModuleId}
        className="mb-6"
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle className="text-2xl">{ctx.module.title}</CardTitle>
          <div className="flex items-center gap-2">
            <HighlightStarButton
              target="module"
              moduleId={moduleId}
              programId={id}
              highlighted={highlightedModuleIds.has(moduleId)}
              label={ctx.module.title}
            />
            {ctx.canEdit ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/instructor/programs/${id}/modules/${moduleId}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit module
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {ctx.module.content ? (
            <article className="whitespace-pre-wrap rounded-lg bg-muted p-6 text-sm leading-relaxed">
              {ctx.module.content}
            </article>
          ) : (
            <p className="text-sm text-muted-foreground">No overview content for this module.</p>
          )}

          {linkedResources.length > 0 ? (
            <ModuleResourceList
              programId={id}
              moduleId={moduleId}
              resources={linkedResources}
              enrolled={ctx.enrolled}
              completedResourceIds={ctx.completedResourceIds}
            />
          ) : null}

          <ModuleChecklistsSection
            programId={id}
            moduleId={moduleId}
            checklists={checklists}
            enrolled={ctx.enrolled}
            embedded
          />

          {ctx.resources.length === 0 ? (
            <MarkModuleCompleteButton
              programId={id}
              moduleId={moduleId}
              enrolled={ctx.enrolled}
              completed={ctx.completed}
            />
          ) : ctx.enrolled && ctx.completed ? (
            <p className="text-sm font-medium text-green-500">All module items completed</p>
          ) : null}
        </CardContent>
      </Card>

      <ModulePageNav
        programId={id}
        prevModuleId={ctx.prevModuleId}
        nextModuleId={ctx.nextModuleId}
        className="mt-6"
      />
    </>
  );
}
