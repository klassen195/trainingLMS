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

  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("program_id, status")
    .eq("user_id", profile.id)
    .eq("status", "active");

  if (isMissingTrainingLmsTables(enrollError)) return <DatabaseSetup />;
  if (enrollError) throw enrollError;

  const programIds = (enrollments ?? []).map((e) => e.program_id);
  let programs: Program[] = [];
  if (programIds.length) {
    const { data, error } = await supabase.from("programs").select("*").in("id", programIds);
    if (error) throw error;
    programs = (data ?? []) as Program[];
  }

  const progressByProgram = new Map<string, number>();
  for (const program of programs) {
    const { count: moduleCount } = await supabase
      .from("modules")
      .select("id", { count: "exact", head: true })
      .eq("program_id", program.id);

    const { data: modules } = await supabase.from("modules").select("id").eq("program_id", program.id);
    const moduleIds = (modules ?? []).map((m) => m.id);
    let completedCount = 0;
    if (moduleIds.length) {
      const { count } = await supabase
        .from("module_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .in("module_id", moduleIds);
      completedCount = count ?? 0;
    }
    progressByProgram.set(program.id, progressPercent(moduleCount ?? 0, completedCount));
  }

  return (
    <>
      <TopNav profile={profile} active="dashboard" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">My training</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Programs you are enrolled in and module progress.
        </p>

        {programs.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            You are not enrolled in any programs yet. Browse the{" "}
            <a href="/programs" className="font-medium text-[#C11B2B] underline">
              program catalog
            </a>
            .
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {programs.map((program) => {
              const pct = progressByProgram.get(program.id) ?? 0;
              return (
                <li key={program.id} className="space-y-2">
                  <ProgramCard program={program} enrolled progressPercent={pct} />
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
