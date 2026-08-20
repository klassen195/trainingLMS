"use server";

import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth";
import { isFlagLevel, parseHomeWidgetTypes, type FlagLevel, type HomeWidgetType } from "@/lib/home-dashboard-types";
import { isAdmin } from "@/lib/permissions";
import { isMissingHomeDashboardTables, supabaseErrorMessage } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function uniqueWidgetTypes(types: string[]): HomeWidgetType[] {
  const parsed = parseHomeWidgetTypes(types);
  return parsed ?? [];
}

export async function saveHomeDashboardLayout(widgetTypes: string[]) {
  const profile = await requireUserProfile();
  const widgets = uniqueWidgetTypes(widgetTypes);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("home_dashboard_layouts").upsert(
    {
      profile_id: profile.id,
      client_id: profile.client_id,
      widget_types: widgets,
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    if (isMissingHomeDashboardTables(error)) {
      throw new Error(
        "Database not set up yet. Run supabase/migrations/20260820130000_home_dashboard.sql, then refresh."
      );
    }
    throw new Error(supabaseErrorMessage(error));
  }

  revalidatePath("/");
}

export async function setDepartmentFlagLevel(level: string) {
  const profile = await requireUserProfile();
  if (!isAdmin(profile)) {
    throw new Error("Only administrators can post the flag status.");
  }
  if (!isFlagLevel(level)) {
    throw new Error("Choose a valid flag level.");
  }
  const flagLevel: FlagLevel = level;
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("client_ops_settings")
    .select("client_id")
    .maybeSingle();

  if (existingError && isMissingHomeDashboardTables(existingError)) {
    throw new Error(
      "Database not set up yet. Run supabase/migrations/20260820130000_home_dashboard.sql, then refresh."
    );
  }
  if (existingError) throw new Error(supabaseErrorMessage(existingError));

  const payload = {
    client_id: profile.client_id,
    flag_level: flagLevel,
    flag_updated_at: new Date().toISOString(),
    flag_updated_by: profile.id,
  };

  const { error } = existing
    ? await supabase.from("client_ops_settings").update(payload).eq("client_id", profile.client_id)
    : await supabase.from("client_ops_settings").insert(payload);

  if (error) throw new Error(supabaseErrorMessage(error));
  revalidatePath("/");
}
