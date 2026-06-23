import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { AssignmentSubmitForm } from "./ui";
import type { Assignment } from "@/lib/training-lms-types";

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const profile = await requireUserProfile();
  const { id, assignmentId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!enrollment) redirect(`/courses/${id}`);

  const { data: assignment } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .eq("course_id", id)
    .maybeSingle();
  if (!assignment) notFound();

  const { data: submission } = await supabase
    .from("assignment_submissions")
    .select("content, submitted_at")
    .eq("assignment_id", assignmentId)
    .eq("user_id", profile.id)
    .maybeSingle();

  const typedAssignment = assignment as Assignment;

  return (
    <>
      <TopNav profile={profile} active="courses" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <Link href={`/courses/${id}`} className="text-sm text-[#C11B2B] underline">
          Back to course
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-[#0B2E4B]">{typedAssignment.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
          {typedAssignment.description}
        </p>
        <div className="mt-6">
          <AssignmentSubmitForm
            courseId={id}
            assignmentId={assignmentId}
            initialContent={submission?.content ?? ""}
          />
        </div>
        {submission?.submitted_at ? (
          <p className="mt-3 text-xs text-zinc-500">Last submitted: {new Date(submission.submitted_at).toLocaleString()}</p>
        ) : null}
      </main>
    </>
  );
}
