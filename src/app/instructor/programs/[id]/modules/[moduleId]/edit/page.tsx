import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { programModulesFromRows } from "@/lib/program-modules";
import { loadChecklistItemsByResourceIds } from "@/lib/checklist-data";
import { ModuleEditForm } from "@/components/ModuleEditForm";
import { Button } from "@/components/ui/Button";
import type { ModuleResource } from "@/lib/training-lms-types";

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const profile = await requireRole(["instructor", "admin"]);
  const { id, moduleId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: program } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (!program) notFound();
  if (profile.role === "instructor" && program.created_by !== profile.id) notFound();

  const { data: programLink } = await supabase
    .from("program_modules")
    .select("sort_order, modules(*)")
    .eq("program_id", id)
    .eq("module_id", moduleId)
    .maybeSingle();
  if (!programLink) notFound();

  const moduleItem = programModulesFromRows([programLink])[0];
  if (!moduleItem) notFound();

  const canEditContent = profile.role === "admin" || moduleItem.created_by === profile.id;

  const { data: resources } = await supabase
    .from("module_resources")
    .select("*")
    .eq("module_id", moduleId)
    .order("sort_order");

  const resourceList = (resources ?? []) as ModuleResource[];
  const checklistResourceIds = resourceList
    .filter((resource) => resource.resource_type === "checklist")
    .map((resource) => resource.id);
  const checklistItemsByResourceId = await loadChecklistItemsByResourceIds(supabase, checklistResourceIds);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-4xl font-bold">Edit module</h1>
          <p className="text-lg text-muted-foreground">{program.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/instructor/programs/${id}/edit`}>Back to program</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/programs/${id}/modules/${moduleId}`}>View module</Link>
          </Button>
        </div>
      </div>

      <ModuleEditForm
        programId={id}
        moduleItem={moduleItem}
        canEdit={canEditContent}
        isAdmin={profile.role === "admin"}
        resources={resourceList}
        checklistItemsByResourceId={checklistItemsByResourceId}
      />
    </div>
  );
}
