import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { programModulesFromRows } from "@/lib/program-modules";
import { EditProgramForm } from "./ui";
import { Button } from "@/components/ui/Button";
import type { Module, Program } from "@/lib/training-lms-types";

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

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-4xl font-bold">Edit program</h1>
          <p className="text-lg text-muted-foreground">Update program details and manage modules.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/programs/${id}`}>View program</Link>
        </Button>
      </div>
      <EditProgramForm
        program={program as Program}
        modules={modules}
        linkableModules={linkableModules}
        editableModuleIds={[...editableModuleIds]}
      />
    </div>
  );
}
