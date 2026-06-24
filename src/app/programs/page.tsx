import { GraduationCap } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { ProgramCard } from "@/components/ProgramCard";
import { categoryLabel } from "@/lib/labels";
import { groupProgramsByCategory } from "@/lib/program-catalog";
import type { Program } from "@/lib/training-lms-types";

export default async function ProgramsPage() {
  await requireUserProfile();
  const supabase = await createSupabaseServerClient();

  const { data: programs, error } = await supabase
    .from("programs")
    .select("*")
    .eq("status", "published")
    .order("title");

  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  const programList = (programs ?? []) as Program[];
  const moduleCounts = new Map<string, number>();

  for (const program of programList) {
    const { count } = await supabase
      .from("program_modules")
      .select("module_id", { count: "exact", head: true })
      .eq("program_id", program.id);
    moduleCounts.set(program.id, count ?? 0);
  }

  const sections = groupProgramsByCategory(programList);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Program Catalog</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Browse published training programs organized by division.
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No published programs yet.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {sections.map(({ category, programs: categoryPrograms }) => (
            <section key={category}>
              <h2 className="mb-6 border-b pb-3 text-2xl font-bold">{categoryLabel(category)}</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categoryPrograms.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    moduleCount={moduleCounts.get(program.id) ?? 0}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
