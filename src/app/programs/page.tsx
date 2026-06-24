import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { TopNav } from "@/components/TopNav";
import { ProgramCard } from "@/components/ProgramCard";
import { categoryLabel, programCategories } from "@/lib/labels";
import type { Program, ProgramCategory } from "@/lib/training-lms-types";
import Link from "next/link";

function filterLinkClass(active: boolean) {
  return active
    ? "rounded-lg border border-[#C11B2B] bg-[#C11B2B] px-3 py-1.5 text-sm text-white"
    : "rounded-lg border border-zinc-200 px-3 py-1.5 text-sm";
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const profile = await requireUserProfile();
  const params = await searchParams;
  const category = params.category as ProgramCategory | undefined;
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("programs").select("*").eq("status", "published").order("title");
  if (category && programCategories.includes(category)) {
    query = query.eq("category", category);
  }
  const { data: programs, error } = await query;
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  return (
    <>
      <TopNav profile={profile} active="programs" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">Program catalog</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/programs" className={filterLinkClass(!category)}>
            All
          </Link>
          {programCategories.map((cat) => (
            <Link key={cat} href={`/programs?category=${cat}`} className={filterLinkClass(category === cat)}>
              {categoryLabel(cat)}
            </Link>
          ))}
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {((programs ?? []) as Program[]).map((program) => (
            <li key={program.id}>
              <ProgramCard program={program} />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
