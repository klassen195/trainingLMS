import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/training-lms-types";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error && !isMissingTrainingLmsTables(error)) throw error;
  return data as Profile | null;
}

export async function requireUserProfile(): Promise<Profile> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error && !isMissingTrainingLmsTables(error)) throw error;
  if (!data) redirect("/dashboard");
  return data as Profile;
}

export function hasRole(profile: Profile, roles: UserRole[]) {
  return roles.includes(profile.role);
}

export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireUserProfile();
  if (!hasRole(profile, roles)) redirect("/dashboard");
  return profile;
}
