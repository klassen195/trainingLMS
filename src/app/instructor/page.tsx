import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingTrainingLmsTables } from "@/lib/supabase/errors";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { tagLabel } from "@/lib/labels";
import {
  mapProgramRows,
  PROGRAM_WITH_TAGS_SELECT,
  type ProgramQueryRow,
} from "@/lib/program-tags";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function InstructorPage() {
  const profile = await requireRole(["instructor", "admin"]);
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("programs")
    .select(PROGRAM_WITH_TAGS_SELECT)
    .order("updated_at", { ascending: false });
  if (profile.role === "instructor") {
    query = query.eq("created_by", profile.id);
  }
  const { data: programs, error } = await query;
  if (isMissingTrainingLmsTables(error)) return <DatabaseSetup />;
  if (error) throw error;

  const programList = mapProgramRows(programs as ProgramQueryRow[]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Instructor Programs</h1>
          </div>
          <p className="text-lg text-muted-foreground">Create and manage training programs and modules.</p>
        </div>
        <Button asChild>
          <Link href="/instructor/programs/new">
            <Plus className="mr-2 h-4 w-4" />
            New program
          </Link>
        </Button>
      </div>

      {programList.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No programs yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {programList.map((program) => (
            <Card key={program.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {program.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tagLabel(tag)}
                      </Badge>
                    ))}
                    <Badge variant="secondary" className="capitalize">
                      {program.status}
                    </Badge>
                  </div>
                  <CardTitle>{program.title}</CardTitle>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/instructor/programs/${program.id}/edit`}>Edit</Link>
                </Button>
              </CardHeader>
              {program.description ? (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{program.description}</p>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
