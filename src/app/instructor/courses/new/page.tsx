import { requireRole } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";
import { NewCourseForm } from "./ui";

export default async function NewCoursePage() {
  const profile = await requireRole(["instructor", "admin"]);

  return (
    <>
      <TopNav profile={profile} active="instructor" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">Create course</h1>
        <div className="mt-6">
          <NewCourseForm />
        </div>
      </main>
    </>
  );
}
