import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { TopNav } from "@/components/TopNav";
import type { Profile } from "@/lib/training-lms-types";
import { AdminUserManager } from "./ui";

export default async function AdminPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at");
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  return (
    <>
      <TopNav profile={profile} active="admin" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">User profiles</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Select a member to edit their name, rank, and role.
        </p>

        <AdminUserManager users={(profiles ?? []) as Profile[]} />
      </main>
    </>
  );
}
