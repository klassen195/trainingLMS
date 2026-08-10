import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/training-lms-types";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { canAuthorTraining, hasRole, isAdmin } from "@/lib/permissions";
import { loadCapabilityMatrix } from "@/lib/capability-matrix";
import { profileHasCapability } from "@/lib/capabilities";

export type AuthContext =
  | { kind: "unauthenticated" }
  | { kind: "missing_tables" }
  | { kind: "missing_profile"; userId: string }
  | { kind: "authenticated"; profile: Profile };

export { canAuthorTraining, hasRole, isAdmin, isRecruit } from "@/lib/permissions";

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
  const profile = data as Profile;

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?error=account_deactivated");
  }

  return {
    kind: "authenticated",
    profile: { ...profile, is_admin: Boolean(profile.is_admin), is_active: true },
  };
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

export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireUserProfile();
  if (!hasRole(profile, roles) && !profile.is_admin) redirect("/dashboard");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUserProfile();
  if (!isAdmin(profile)) redirect("/dashboard");
  return profile;
}

export async function requireCaptainOrAdmin(): Promise<Profile> {
  const profile = await requireUserProfile();
  if (isAdmin(profile)) return profile;
  const matrix = await loadCapabilityMatrix();
  if (!profileHasCapability(profile, "author_training", matrix)) redirect("/dashboard");
  return profile;
}
