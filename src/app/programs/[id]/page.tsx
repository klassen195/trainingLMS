import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { TopNav } from "@/components/TopNav";
import { EnrollButton } from "@/components/EnrollButton";
import { categoryLabel } from "@/lib/labels";
import type { Module, Program } from "@/lib/training-lms-types";

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUserProfile();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: program, error } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;
  if (!program) notFound();

  const { data: modules } = await supabase
    .from("modules")
    .select("*")
    .eq("program_id", id)
    .order("sort_order");

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("program_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();

  const enrolled = Boolean(enrollment);
  const typedProgram = program as Program;

  return (
    <>
      <TopNav profile={profile} active="programs" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[#C11B2B]">
          {categoryLabel(typedProgram.category)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0B2E4B]">{typedProgram.title}</h1>
        {typedProgram.description ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{typedProgram.description}</p>
        ) : null}

        {typedProgram.status === "published" && !enrolled ? (
          <div className="mt-4">
            <EnrollButton programId={id} />
          </div>
        ) : null}

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Modules</h2>
          <ul className="mt-3 space-y-2">
            {((modules ?? []) as Module[]).map((moduleItem) => (
              <li key={moduleItem.id}>
                {enrolled ? (
                  <Link href={`/programs/${id}/modules/${moduleItem.id}`} className="text-[#0B2E4B] underline">
                    {moduleItem.title}
                  </Link>
                ) : (
                  <span className="text-zinc-500">{moduleItem.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
