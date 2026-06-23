import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { TopNav } from "@/components/TopNav";
import type { Profile, UserRole } from "@/lib/training-lms-types";
import { AdminUserForm } from "./ui";

export default async function AdminPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at");
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  return (
    <>
      <TopNav profile={profile} active="admin" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">User profiles</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Edit member names, ranks, and roles for TrainingLMS.
        </p>

        <ul className="mt-6 space-y-4">
          {((profiles ?? []) as Profile[]).map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <AdminUserForm
                userId={p.id}
                email={p.email}
                displayName={p.display_name}
                rank={p.rank}
                currentRole={p.role as UserRole}
              />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
