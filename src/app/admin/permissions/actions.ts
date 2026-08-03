"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { APP_CAPABILITIES, type AppCapability } from "@/lib/capabilities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseErrorMessage } from "@/lib/supabase/errors";
import type { UserRole } from "@/lib/training-lms-types";

const roles: UserRole[] = ["recruit", "firefighter", "captain"];

export async function updateCapabilityMatrix(input: {
  rows: { role: UserRole; capability: AppCapability; enabled: boolean }[];
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  for (const row of input.rows) {
    if (!roles.includes(row.role)) throw new Error("Invalid permission level");
    if (!(APP_CAPABILITIES as readonly string[]).includes(row.capability)) {
      throw new Error("Invalid capability");
    }
  }

  const { error } = await supabase.from("permission_level_capabilities").upsert(
    input.rows.map((row) => ({
      role: row.role,
      capability: row.capability,
      enabled: row.enabled,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "role,capability" }
  );

  if (error) throw new Error(supabaseErrorMessage(error));

  revalidatePath("/admin/permissions");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}
