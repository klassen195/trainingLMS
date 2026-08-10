import Link from "next/link";
import { ClipboardPen } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { listTrainingSessionProfiles } from "@/app/document-training/actions";
import { listTrainingCategories } from "@/lib/training-categories";
import { listQualifications } from "@/lib/qualifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DocumentTrainingForm } from "@/components/DocumentTrainingForm";
import { Button } from "@/components/ui/Button";

export default async function NewDocumentTrainingPage() {
  await requireCapability("document_training");
  const supabase = await createSupabaseServerClient();
  const [
    profiles,
    { rows: categories, error: categoriesError },
    { rows: qualifications, error: qualificationsError },
  ] = await Promise.all([
    listTrainingSessionProfiles(),
    listTrainingCategories(supabase, { activeOnly: true }),
    listQualifications(supabase, { activeOnly: true }),
  ]);
  if (categoriesError) throw new Error(categoriesError.message);
  if (qualificationsError) throw new Error(qualificationsError.message);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ClipboardPen className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Log training</h1>
        </div>
        <p className="text-muted-foreground">
          Start by choosing in-house training or a certification course, then fill in the details.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/document-training">Back to list</Link>
          </Button>
        </div>
      </div>

      <DocumentTrainingForm
        profiles={profiles}
        categories={categories}
        qualifications={qualifications}
      />
    </div>
  );
}
