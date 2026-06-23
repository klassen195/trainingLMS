import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { MarkLessonCompleteButton } from "@/components/MarkLessonCompleteButton";
import type { Lesson } from "@/lib/training-lms-types";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const profile = await requireUserProfile();
  const { id, lessonId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!enrollment) redirect(`/courses/${id}`);

  const { data: lesson } = await supabase.from("lessons").select("*").eq("id", lessonId).eq("course_id", id).maybeSingle();
  if (!lesson) notFound();

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("user_id", profile.id)
    .maybeSingle();

  const typedLesson = lesson as Lesson;

  return (
    <>
      <TopNav profile={profile} active="courses" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <Link href={`/courses/${id}`} className="text-sm text-[#C11B2B] underline">
          Back to course
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-[#0B2E4B]">{typedLesson.title}</h1>
        <article className="prose prose-zinc mt-6 max-w-none whitespace-pre-wrap text-sm dark:prose-invert">
          {typedLesson.content}
        </article>
        <div className="mt-8">
          <MarkLessonCompleteButton courseId={id} lessonId={lessonId} completed={Boolean(progress)} />
        </div>
      </main>
    </>
  );
}
