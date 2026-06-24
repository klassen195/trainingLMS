import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { EditProgramForm } from "./ui";
import type { Module, Program } from "@/lib/training-lms-types";

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["instructor", "admin"]);
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: program } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (!program) notFound();
  if (profile.role === "instructor" && program.created_by !== profile.id) notFound();

  const { data: modules } = await supabase.from("modules").select("*").eq("program_id", id).order("sort_order");

  return (
    <>
      <TopNav profile={profile} active="instructor" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-[#0B2E4B]">Edit program</h1>
        <div className="mt-6">
          <EditProgramForm program={program as Program} modules={(modules ?? []) as Module[]} />
        </div>
      </main>
    </>
  );
}
