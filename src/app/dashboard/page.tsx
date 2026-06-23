import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { TopNav } from "@/components/TopNav";
import { CourseCard } from "@/components/CourseCard";
import { ProgressBar } from "@/components/ProgressBar";
import type { Course } from "@/lib/training-lms-types";

function progressPercent(lessonCount: number, completedCount: number) {
  if (lessonCount === 0) return 0;
  return Math.round((completedCount / lessonCount) * 100);
}

export default async function DashboardPage() {
  const profile = await requireUserProfile();
  const supabase = await createSupabaseServerClient();

  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("course_id, status")
    .eq("user_id", profile.id)
    .eq("status", "active");

  if (isMissingTrainingLmsTables(enrollError)) return <DatabaseSetup />;
  if (enrollError) throw enrollError;

  const courseIds = (enrollments ?? []).map((e) => e.course_id);
  let courses: Course[] = [];
  if (courseIds.length) {
    const { data, error } = await supabase.from("courses").select("*").in("id", courseIds);
    if (error) throw error;
    courses = (data ?? []) as Course[];
  }

  const progressByCourse = new Map<string, number>();
  for (const course of courses) {
    const { count: lessonCount } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", course.id);

    const { data: lessons } = await supabase.from("lessons").select("id").eq("course_id", course.id);
    const lessonIds = (lessons ?? []).map((l) => l.id);
    let completedCount = 0;
    if (lessonIds.length) {
      const { count } = await supabase
        .from("lesson_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .in("lesson_id", lessonIds);
      completedCount = count ?? 0;
    }
    progressByCourse.set(course.id, progressPercent(lessonCount ?? 0, completedCount));
  }

  return (
    <>
      <TopNav profile={profile} active="dashboard" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">My training</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Courses you are enrolled in and lesson progress.
        </p>

        {courses.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            You are not enrolled in any courses yet. Browse the <a href="/courses" className="font-medium text-[#C11B2B] underline">course catalog</a>.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {courses.map((course) => {
              const pct = progressByCourse.get(course.id) ?? 0;
              return (
                <li key={course.id} className="space-y-2">
                  <CourseCard course={course} enrolled progressPercent={pct} />
                  <ProgressBar value={pct} />
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
