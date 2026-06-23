import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { TopNav } from "@/components/TopNav";
import { EnrollButton } from "@/components/EnrollButton";
import { categoryLabel } from "@/lib/labels";
import type { Assignment, Course, Lesson } from "@/lib/training-lms-types";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUserProfile();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: course, error } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;
  if (!course) notFound();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", id)
    .order("sort_order");
  const { data: assignments } = await supabase
    .from("assignments")
    .select("*")
    .eq("course_id", id)
    .order("sort_order");

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();

  const enrolled = Boolean(enrollment);
  const typedCourse = course as Course;

  return (
    <>
      <TopNav profile={profile} active="courses" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[#C11B2B]">
          {categoryLabel(typedCourse.category)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0B2E4B]">{typedCourse.title}</h1>
        {typedCourse.description ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{typedCourse.description}</p>
        ) : null}

        {typedCourse.status === "published" && !enrolled ? (
          <div className="mt-4">
            <EnrollButton courseId={id} />
          </div>
        ) : null}

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Lessons</h2>
          <ul className="mt-3 space-y-2">
            {((lessons ?? []) as Lesson[]).map((lesson) => (
              <li key={lesson.id}>
                {enrolled ? (
                  <Link href={`/courses/${id}/lessons/${lesson.id}`} className="text-[#0B2E4B] underline">
                    {lesson.title}
                  </Link>
                ) : (
                  <span className="text-zinc-500">{lesson.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Assignments</h2>
          <ul className="mt-3 space-y-2">
            {((assignments ?? []) as Assignment[]).map((assignment) => (
              <li key={assignment.id}>
                {enrolled ? (
                  <Link
                    href={`/courses/${id}/assignments/${assignment.id}`}
                    className="text-[#0B2E4B] underline"
                  >
                    {assignment.title}
                  </Link>
                ) : (
                  <span className="text-zinc-500">{assignment.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
