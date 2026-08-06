import { readFile } from "fs/promises";
import path from "path";
import { Lightbulb } from "lucide-react";
import { requireUserProfile } from "@/lib/auth";
import { IdeasMarkdown } from "@/components/IdeasMarkdown";

export default async function IdeasPage() {
  await requireUserProfile();

  const markdown = await readFile(path.join(process.cwd(), "ideas.md"), "utf8");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Lightbulb className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-bold">Ideas</h1>
      </div>

      <IdeasMarkdown source={markdown} />
    </div>
  );
}
