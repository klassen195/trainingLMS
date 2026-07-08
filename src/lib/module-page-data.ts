import { cache } from "react";
import { notFound } from "next/navigation";
import { hasRole } from "@/lib/auth";
import { programModulesFromRows } from "@/lib/program-modules";
import { getYouTubeEmbedUrl, parseYouTubeVideoId } from "@/lib/module-resources";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Module, ModuleResource, ModuleResourceWithUrl, Profile, Program } from "@/lib/training-lms-types";

export type ModulePageContext = {
  profile: Profile;
  program: Pick<Program, "id" | "title" | "created_by">;
  module: Module;
  resources: ModuleResource[];
  resourcesWithUrls: ModuleResourceWithUrl[];
  prevModuleId: string | null;
  nextModuleId: string | null;
  canEdit: boolean;
  enrolled: boolean;
  completed: boolean;
  completedResourceIds: string[];
};

export async function resolveResourceUrls(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resources: ModuleResource[]
): Promise<ModuleResourceWithUrl[]> {
  return Promise.all(
    resources.map(async (resource) => {
      if (resource.resource_type === "youtube") {
        const videoId = parseYouTubeVideoId(resource.external_url ?? "");
        return { ...resource, url: videoId ? getYouTubeEmbedUrl(videoId) : null };
      }
      if (resource.resource_type === "link") {
        return { ...resource, url: resource.external_url };
      }
      if (!resource.storage_path) return { ...resource, url: null };
      const { data: signed } = await supabase.storage
        .from("module-resources")
        .createSignedUrl(resource.storage_path, 3600);
      return { ...resource, url: signed?.signedUrl ?? null };
    })
  );
}

export const getModulePageContext = cache(async (
  programId: string,
  moduleId: string,
  profile: Profile
): Promise<ModulePageContext> => {
  const supabase = await createSupabaseServerClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, created_by")
    .eq("id", programId)
    .maybeSingle();
  if (!program) notFound();

  const { data: programLink } = await supabase
    .from("program_modules")
    .select("module_id")
    .eq("program_id", programId)
    .eq("module_id", moduleId)
    .maybeSingle();
  if (!programLink) notFound();

  const { data: programModuleRows } = await supabase
    .from("program_modules")
    .select("sort_order, modules(*)")
    .eq("program_id", programId)
    .order("sort_order");

  const modules = programModulesFromRows(programModuleRows);
  const moduleIndex = modules.findIndex((item) => item.id === moduleId);
  if (moduleIndex === -1) notFound();

  const { data: moduleRow } = await supabase.from("modules").select("*").eq("id", moduleId).maybeSingle();
  if (!moduleRow) notFound();

  const { data: resources } = await supabase
    .from("module_resources")
    .select("*")
    .eq("module_id", moduleId)
    .order("sort_order");

  const resourceList = (resources ?? []) as ModuleResource[];
  const resourcesWithUrls = await resolveResourceUrls(supabase, resourceList);

  const { data: enrollment } = await supabase
    .from("module_enrollments")
    .select("id")
    .eq("module_id", moduleId)
    .eq("user_id", profile.id)
    .maybeSingle();

  const enrolled = Boolean(enrollment);

  let completed = false;
  let completedResourceIds: string[] = [];
  if (enrolled) {
    const { data: progress } = await supabase
      .from("module_progress")
      .select("id")
      .eq("module_id", moduleId)
      .eq("user_id", profile.id)
      .maybeSingle();
    completed = Boolean(progress);

    const resourceIds = resourceList.map((item) => item.id);
    if (resourceIds.length > 0) {
      const { data: resourceProgress } = await supabase
        .from("resource_progress")
        .select("resource_id")
        .eq("user_id", profile.id)
        .in("resource_id", resourceIds);
      completedResourceIds = (resourceProgress ?? []).map((row) => row.resource_id);
    }
  }

  const prevModule = moduleIndex > 0 ? modules[moduleIndex - 1] : null;
  const nextModule = moduleIndex < modules.length - 1 ? modules[moduleIndex + 1] : null;

  return {
    profile,
    program: program as Pick<Program, "id" | "title" | "created_by">,
    module: moduleRow as Module,
    resources: resourceList,
    resourcesWithUrls,
    prevModuleId: prevModule?.id ?? null,
    nextModuleId: nextModule?.id ?? null,
    canEdit:
      hasRole(profile, ["admin"]) ||
      (hasRole(profile, ["instructor"]) && program.created_by === profile.id),
    enrolled,
    completed,
    completedResourceIds,
  };
});
