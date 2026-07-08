import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/training-lms-types";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";

export type AuthContext =
  | { kind: "unauthenticated" }
  | { kind: "missing_tables" }
  | { kind: "missing_profile"; userId: string }
  | { kind: "authenticated"; profile: Profile };

export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthenticated" };

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error && isMissingTrainingLmsTables(error)) return { kind: "missing_tables" };
  if (error) throw error;
  if (!data) return { kind: "missing_profile", userId: user.id };
  return { kind: "authenticated", profile: data as Profile };
});

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const ctx = await getAuthContext();
  return ctx.kind === "authenticated" ? ctx.profile : null;
}

export async function requireUserProfile(): Promise<Profile> {
  const ctx = await getAuthContext();
  if (ctx.kind === "unauthenticated") redirect("/login");
  if (ctx.kind === "missing_profile" || ctx.kind === "missing_tables") redirect("/dashboard");
  return ctx.profile;
}

export function hasRole(profile: Profile, roles: UserRole[]) {
  return roles.includes(profile.role);
}

export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireUserProfile();
  if (!hasRole(profile, roles)) redirect("/dashboard");
  return profile;
}
