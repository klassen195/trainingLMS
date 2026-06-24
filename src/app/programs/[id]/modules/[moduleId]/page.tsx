import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { MarkModuleCompleteButton } from "@/components/MarkModuleCompleteButton";
import type { Module } from "@/lib/training-lms-types";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const profile = await requireUserProfile();
  const { id, moduleId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("program_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!enrollment) redirect(`/programs/${id}`);

  const { data: moduleRow } = await supabase
    .from("modules")
    .select("*")
    .eq("id", moduleId)
    .eq("program_id", id)
    .maybeSingle();
  if (!moduleRow) notFound();

  const { data: progress } = await supabase
    .from("module_progress")
    .select("id")
    .eq("module_id", moduleId)
    .eq("user_id", profile.id)
    .maybeSingle();

  const typedModule = moduleRow as Module;

  return (
    <>
      <TopNav profile={profile} active="programs" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <Link href={`/programs/${id}`} className="text-sm text-[#C11B2B] underline">
          Back to program
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-[#0B2E4B]">{typedModule.title}</h1>
        <article className="prose prose-zinc mt-6 max-w-none whitespace-pre-wrap text-sm dark:prose-invert">
          {typedModule.content}
        </article>
        <div className="mt-8">
          <MarkModuleCompleteButton programId={id} moduleId={moduleId} completed={Boolean(progress)} />
        </div>
      </main>
    </>
  );
}
