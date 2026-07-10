import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { tagLabel, programTags } from "@/lib/labels";
import type { ProgramTag } from "@/lib/training-lms-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function ProgramCategoryGrid({
  programCounts,
  basePath = "/programs",
}: {
  programCounts: Map<string, number>;
  basePath?: string;
}) {
  const tagsWithPrograms = programTags.filter((tag) => (programCounts.get(tag) ?? 0) > 0);

  if (tagsWithPrograms.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center">
        <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No published programs yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tagsWithPrograms.map((tag) => {
        const count = programCounts.get(tag) ?? 0;
        return (
          <Link key={tag} href={`${basePath}?tag=${tag}`}>
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <GraduationCap className="h-6 w-6 text-primary" />
                  {tagLabel(tag as ProgramTag)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {count} program{count === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
