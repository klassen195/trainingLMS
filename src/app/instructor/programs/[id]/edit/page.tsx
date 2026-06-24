import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { programModulesFromRows } from "@/lib/program-modules";
import { TopNav } from "@/components/TopNav";
import { EditProgramForm } from "./ui";
import type { Module, ModuleResource, Program } from "@/lib/training-lms-types";

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["instructor", "admin"]);
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: program } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (!program) notFound();
  if (profile.role === "instructor" && program.created_by !== profile.id) notFound();

  const { data: programModuleRows } = await supabase
    .from("program_modules")
    .select("sort_order, modules(*)")
    .eq("program_id", id)
    .order("sort_order");

  const modules = programModulesFromRows(programModuleRows);
  const linkedModuleIds = new Set(modules.map((moduleItem) => moduleItem.id));

  const { data: allModules } = await supabase.from("modules").select("*").order("title");
  const linkableModules = ((allModules ?? []) as Module[]).filter((moduleItem) => !linkedModuleIds.has(moduleItem.id));
  const editableModuleIds = new Set(
    modules
      .filter((moduleItem) => profile.role === "admin" || moduleItem.created_by === profile.id)
      .map((moduleItem) => moduleItem.id)
  );

  const moduleIds = modules.map((moduleItem) => moduleItem.id);
  const resourcesByModuleId: Record<string, ModuleResource[]> = {};
  if (moduleIds.length) {
    const { data: resources } = await supabase
      .from("module_resources")
      .select("*")
      .in("module_id", moduleIds)
      .order("sort_order");
    for (const resource of (resources ?? []) as ModuleResource[]) {
      (resourcesByModuleId[resource.module_id] ??= []).push(resource);
    }
  }

  return (
    <>
      <TopNav profile={profile} active="instructor" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">Edit program</h1>
        <div className="mt-6">
          <EditProgramForm
            program={program as Program}
            modules={modules}
            linkableModules={linkableModules}
            editableModuleIds={editableModuleIds}
            resourcesByModuleId={resourcesByModuleId}
          />
        </div>
      </main>
    </>
  );
}
