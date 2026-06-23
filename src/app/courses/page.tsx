import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { TopNav } from "@/components/TopNav";
import { CourseCard } from "@/components/CourseCard";
import { categoryLabel, courseCategories } from "@/lib/labels";
import type { Course, CourseCategory } from "@/lib/training-lms-types";
import Link from "next/link";

function filterLinkClass(active: boolean) {
  return active
    ? "rounded-lg border border-[#C11B2B] bg-[#C11B2B] px-3 py-1.5 text-sm text-white"
    : "rounded-lg border border-zinc-200 px-3 py-1.5 text-sm";
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const profile = await requireUserProfile();
  const params = await searchParams;
  const category = params.category as CourseCategory | undefined;
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("courses").select("*").eq("status", "published").order("title");
  if (category && courseCategories.includes(category)) {
    query = query.eq("category", category);
  }
  const { data: courses, error } = await query;
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  const { data: enrollments } = await supabase.from("enrollments").select("course_id").eq("user_id", profile.id);
  const enrolledIds = new Set((enrollments ?? []).map((e) => e.course_id));

  return (
    <>
      <TopNav profile={profile} active="courses" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">Course catalog</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/courses" className={filterLinkClass(!category)}>All</Link>
          {courseCategories.map((cat) => (
            <Link key={cat} href={`/courses?category=${cat}`} className={filterLinkClass(category === cat)}>
              {categoryLabel(cat)}
            </Link>
          ))}
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {((courses ?? []) as Course[]).map((course) => (
            <li key={course.id}>
              <CourseCard course={course} enrolled={enrolledIds.has(course.id)} />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
