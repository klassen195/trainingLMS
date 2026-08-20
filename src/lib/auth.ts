import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CHANGE_PASSWORD_PATH, userMustChangePassword } from "@/lib/auth-password";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseSessionCookie } from "@/lib/supabase/session-cookie";
import { PROFILE_PERMISSION_LEVELS_EMBED } from "@/lib/permission-levels-types";
import { loadProfilePermissionLevels, parseProfilePermissionLevels } from "@/lib/permission-levels";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { hasRole, isAdmin } from "@/lib/permissions";
import { loadCapabilityMatrix } from "@/lib/capability-matrix";
import { profileHasCapability } from "@/lib/capabilities";
import type { Profile } from "@/lib/training-lms-types";

export type AuthContext =
  | { kind: "unauthenticated" }
  | { kind: "missing_tables" }
  | { kind: "missing_profile"; userId: string }
  | {
      kind: "authenticated";
      profile: Profile;
      clientId: string;
      isPlatformAdmin: boolean;
      mustChangePassword: boolean;
    };

export { canAuthorTraining, hasRole, isAdmin, isRecruit } from "@/lib/permissions";

function isPlatformAdminFromUser(user: { app_metadata?: Record<string, unknown> } | null): boolean {
  return Boolean(user?.app_metadata?.is_platform_admin);
}

export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const cookieStore = await cookies();
  if (!hasSupabaseSessionCookie(cookieStore.getAll())) {
    return { kind: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .select(`*, ${PROFILE_PERMISSION_LEVELS_EMBED}`)
    .eq("id", user.id)
    .maybeSingle();

  if (error && isMissingTrainingLmsTables(error)) return { kind: "missing_tables" };

  let profile: Profile | null = null;
  if (error) {
    const fallback = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (fallback.error && isMissingTrainingLmsTables(fallback.error)) return { kind: "missing_tables" };
    if (fallback.error) throw fallback.error;
    if (!fallback.data) return { kind: "missing_profile", userId: user.id };
    profile = fallback.data as Profile;
    Object.assign(profile, await loadProfilePermissionLevels(supabase, user.id));
  } else {
    if (!data) return { kind: "missing_profile", userId: user.id };
    profile = {
      ...(data as Profile),
      ...parseProfilePermissionLevels(data as Parameters<typeof parseProfilePermissionLevels>[0]),
    };
  }

  if (!profile) return { kind: "missing_profile", userId: user.id };

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?error=account_deactivated");
  }

  const clientId =
    profile.client_id ||
    (typeof user.app_metadata?.client_id === "string" ? user.app_metadata.client_id : "");

  if (!clientId) {
    await supabase.auth.signOut();
    redirect("/login?error=client_required");
  }

  return {
    kind: "authenticated",
    profile: {
      ...profile,
      client_id: clientId,
      is_admin: Boolean(profile.is_admin),
      is_active: true,
    },
    clientId,
    isPlatformAdmin: isPlatformAdminFromUser(user),
    mustChangePassword: userMustChangePassword(user),
  };
});

export async function requirePlatformAdmin(): Promise<Profile> {
  const ctx = await getAuthContext();
  if (ctx.kind === "unauthenticated") redirect("/login");
  if (ctx.kind !== "authenticated" || !ctx.isPlatformAdmin) redirect("/");
  if (ctx.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  return ctx.profile;
}

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const ctx = await getAuthContext();
  return ctx.kind === "authenticated" ? ctx.profile : null;
}

export async function requireUserProfile(options?: {
  allowMustChangePassword?: boolean;
}): Promise<Profile> {
  const ctx = await getAuthContext();
  if (ctx.kind === "unauthenticated") redirect("/login");
  if (ctx.kind === "missing_profile" || ctx.kind === "missing_tables") redirect("/");
  if (ctx.mustChangePassword && !options?.allowMustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  return ctx.profile;
}

export async function requireRole(permissionLevelIds: string[]): Promise<Profile> {
  const profile = await requireUserProfile();
  if (!hasRole(profile, permissionLevelIds) && !profile.is_admin) redirect("/");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUserProfile();
  if (!isAdmin(profile)) redirect("/");
  return profile;
}

export async function requireCaptainOrAdmin(): Promise<Profile> {
  const profile = await requireUserProfile();
  if (isAdmin(profile)) return profile;
  const { matrix } = await loadCapabilityMatrix();
  if (!profileHasCapability(profile, "author_training", matrix)) redirect("/");
  return profile;
}
