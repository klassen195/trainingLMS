import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { MissingProfileSetup } from "@/components/MissingProfileSetup";
import { TopNav } from "@/components/TopNav";
import { ProgramCard } from "@/components/ProgramCard";
import { ProgressBar } from "@/components/ProgressBar";
import type { Profile, Program } from "@/lib/training-lms-types";

function progressPercent(moduleCount: number, completedCount: number) {
  if (moduleCount === 0) return 0;
  return Math.round((completedCount / moduleCount) * 100);
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError && isMissingTrainingLmsTables(profileError)) return <DatabaseSetup />;
  if (profileError) throw profileError;
  if (!profileRow) return <MissingProfileSetup userId={user.id} />;

  const profile = profileRow as Profile;

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("*")
    .eq("status", "published")
    .order("title");

  if (isMissingTrainingLmsTables(programsError)) return <DatabaseSetup />;
  if (programsError) throw programsError;

  const progressByProgram = new Map<string, number>();
  for (const program of (programs ?? []) as Program[]) {
    const { data: programModuleRows } = await supabase
      .from("program_modules")
      .select("module_id")
      .eq("program_id", program.id);

    const moduleIds = (programModuleRows ?? []).map((row) => row.module_id);
    let completedCount = 0;
    if (moduleIds.length) {
      const { count } = await supabase
        .from("module_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .in("module_id", moduleIds);
      completedCount = count ?? 0;
    }
    progressByProgram.set(program.id, progressPercent(moduleIds.length, completedCount));
  }

  return (
    <>
      <TopNav profile={profile} active="dashboard" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">My training</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Published programs and your module progress.
        </p>

        {(programs ?? []).length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            No published programs yet. Check back soon.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {((programs ?? []) as Program[]).map((program) => {
              const pct = progressByProgram.get(program.id) ?? 0;
              return (
                <li key={program.id} className="space-y-2">
                  <ProgramCard program={program} progressPercent={pct} />
                  <ProgressBar value={pct} />
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
