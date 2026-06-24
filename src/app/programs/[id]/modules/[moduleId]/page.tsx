import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { MarkModuleCompleteButton } from "@/components/MarkModuleCompleteButton";
import { ModuleResourcesViewer } from "@/components/ModuleResourcesViewer";
import { getYouTubeEmbedUrl, parseYouTubeVideoId } from "@/lib/module-resources";
import type { Module, ModuleResource, ModuleResourceWithUrl } from "@/lib/training-lms-types";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const profile = await requireUserProfile();
  const { id, moduleId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: programLink } = await supabase
    .from("program_modules")
    .select("module_id")
    .eq("program_id", id)
    .eq("module_id", moduleId)
    .maybeSingle();
  if (!programLink) notFound();

  const { data: moduleRow } = await supabase.from("modules").select("*").eq("id", moduleId).maybeSingle();
  if (!moduleRow) notFound();

  const { data: progress } = await supabase
    .from("module_progress")
    .select("id")
    .eq("module_id", moduleId)
    .eq("user_id", profile.id)
    .maybeSingle();

  const typedModule = moduleRow as Module;

  const { data: resources } = await supabase
    .from("module_resources")
    .select("*")
    .eq("module_id", moduleId)
    .order("sort_order");

  const resourcesWithUrls: ModuleResourceWithUrl[] = await Promise.all(
    ((resources ?? []) as ModuleResource[]).map(async (resource) => {
      if (resource.resource_type === "youtube") {
        const videoId = parseYouTubeVideoId(resource.external_url ?? "");
        return { ...resource, url: videoId ? getYouTubeEmbedUrl(videoId) : null };
      }
      if (!resource.storage_path) return { ...resource, url: null };
      const { data: signed } = await supabase.storage
        .from("module-resources")
        .createSignedUrl(resource.storage_path, 3600);
      return { ...resource, url: signed?.signedUrl ?? null };
    })
  );

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
        <ModuleResourcesViewer resources={resourcesWithUrls} />
        <div className="mt-8">
          <MarkModuleCompleteButton programId={id} moduleId={moduleId} completed={Boolean(progress)} />
        </div>
      </main>
    </>
  );
}
