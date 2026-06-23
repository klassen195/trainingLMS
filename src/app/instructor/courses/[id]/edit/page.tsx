import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { EditCourseForm } from "./ui";
import type { Assignment, Course, Lesson } from "@/lib/training-lms-types";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["instructor", "admin"]);
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: course } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (!course) notFound();
  if (profile.role === "instructor" && course.created_by !== profile.id) notFound();

  const { data: lessons } = await supabase.from("lessons").select("*").eq("course_id", id).order("sort_order");
  const { data: assignments } = await supabase.from("assignments").select("*").eq("course_id", id).order("sort_order");

  return (
    <>
      <TopNav profile={profile} active="instructor" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">Edit course</h1>
        <div className="mt-6">
          <EditCourseForm
            course={course as Course}
            lessons={(lessons ?? []) as Lesson[]}
            assignments={(assignments ?? []) as Assignment[]}
          />
        </div>
      </main>
    </>
  );
}
