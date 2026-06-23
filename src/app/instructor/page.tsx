import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { TopNav } from "@/components/TopNav";
import { categoryLabel } from "@/lib/labels";
import type { Course } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";

export default async function InstructorPage() {
  const profile = await requireRole(["instructor", "admin"]);
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("courses").select("*").order("updated_at", { ascending: false });
  if (profile.role === "instructor") {
    query = query.eq("created_by", profile.id);
  }
  const { data: courses, error } = await query;
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  return (
    <>
      <TopNav profile={profile} active="instructor" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-[#0B2E4B]">Instructor courses</h1>
          <Link href="/instructor/courses/new">
            <Button variant="primary" className="bg-[#C11B2B] text-white dark:bg-[#C11B2B] dark:text-white">
              New course
            </Button>
          </Link>
        </div>

        <ul className="mt-6 space-y-3">
          {((courses ?? []) as Course[]).map((course) => (
            <li key={course.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#C11B2B]">{categoryLabel(course.category)} · {course.status}</p>
                  <h2 className="text-lg font-semibold">{course.title}</h2>
                </div>
                <Link href={`/instructor/courses/${course.id}/edit`} className="text-sm font-medium text-[#0B2E4B] underline">
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
