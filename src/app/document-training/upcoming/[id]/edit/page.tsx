import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/capability-access";
import { getUpcomingTraining } from "@/app/document-training/upcoming/actions";
import { TrainingSectionNav } from "@/components/TrainingSectionNav";
import { UpcomingTrainingForm } from "@/components/UpcomingTrainingForm";
import { Button } from "@/components/ui/Button";

export default async function EditUpcomingTrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability("manage_upcoming_training");

  let listing: Awaited<ReturnType<typeof getUpcomingTraining>> | null = null;
  try {
    listing = await getUpcomingTraining(id);
  } catch {
    notFound();
  }
  if (!listing) notFound();

  return (
    <div className="container mx-auto px-4 py-5">
      <TrainingSectionNav pathname="/document-training/upcoming" />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Edit opportunity</h1>
          <p className="text-sm text-muted-foreground">{listing.title}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/document-training/upcoming/${listing.id}`}>Back</Link>
        </Button>
      </div>
      <UpcomingTrainingForm initial={listing} />
    </div>
  );
}
