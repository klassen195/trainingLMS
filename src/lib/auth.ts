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
import { isPlatformAdminFromUser } from "@/lib/platform-admin";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
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
    if (!fallback.data) {
      const admin = createSupabaseServiceClient();
      const privileged = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (privileged.error) throw privileged.error;
      if (!privileged.data) return { kind: "missing_profile", userId: user.id };
      profile = privileged.data as Profile;
    } else {
      profile = fallback.data as Profile;
    }
    Object.assign(profile, await loadProfilePermissionLevels(supabase, user.id));
  } else if (!data) {
    const admin = createSupabaseServiceClient();
    const privileged = await admin
      .from("profiles")
      .select(`*, ${PROFILE_PERMISSION_LEVELS_EMBED}`)
      .eq("id", user.id)
      .maybeSingle();
    if (privileged.error && isMissingTrainingLmsTables(privileged.error)) return { kind: "missing_tables" };
    if (privileged.error) {
      const fallback = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (fallback.error) throw fallback.error;
      if (!fallback.data) return { kind: "missing_profile", userId: user.id };
      profile = fallback.data as Profile;
      Object.assign(profile, await loadProfilePermissionLevels(admin, user.id));
    } else if (!privileged.data) {
      return { kind: "missing_profile", userId: user.id };
    } else {
      profile = {
        ...(privileged.data as Profile),
        ...parseProfilePermissionLevels(
          privileged.data as Parameters<typeof parseProfilePermissionLevels>[0]
        ),
      };
    }
  } else {
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

  const isPlatformAdmin = isPlatformAdminFromUser(user);
  let clientId =
    profile.client_id ||
    (typeof user.app_metadata?.client_id === "string" ? user.app_metadata.client_id : "");

  if (isPlatformAdmin) {
    const { data: acting } = await supabase
      .from("platform_operator_context")
      .select("acting_client_id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (acting?.acting_client_id) {
      clientId = acting.acting_client_id as string;
    }
  }

  if (!clientId) {
    await supabase.auth.signOut();
    redirect("/login?error=client_required");
  }

  return {
    kind: "authenticated",
    profile: {
      ...profile,
      client_id: clientId,
      is_admin: Boolean(profile.is_admin) || isPlatformAdmin,
      is_platform_operator: Boolean(profile.is_platform_operator) || isPlatformAdmin,
      is_active: true,
    },
    clientId,
    isPlatformAdmin,
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
  const ctx = await getAuthContext();
  if (ctx.kind === "unauthenticated") redirect("/login");
  if (ctx.kind !== "authenticated") redirect("/");
  if (ctx.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  if (!ctx.isPlatformAdmin && !isAdmin(ctx.profile)) redirect("/");
  return ctx.profile;
}

export async function requireCaptainOrAdmin(): Promise<Profile> {
  const profile = await requireUserProfile();
  if (isAdmin(profile)) return profile;
  const { matrix } = await loadCapabilityMatrix();
  if (!profileHasCapability(profile, "author_training", matrix)) redirect("/");
  return profile;
}
