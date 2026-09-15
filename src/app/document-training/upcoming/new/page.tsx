import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { TrainingSectionNav } from "@/components/TrainingSectionNav";
import { UpcomingTrainingForm } from "@/components/UpcomingTrainingForm";
import { Button } from "@/components/ui/Button";

export default async function NewUpcomingTrainingPage() {
  await requireCapability("manage_upcoming_training");

  return (
    <div className="container mx-auto px-4 py-5">
      <TrainingSectionNav pathname="/document-training/upcoming" />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Advertise training</h1>
          <p className="text-sm text-muted-foreground">
            Create an external course or conference opportunity.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/document-training/upcoming">Back</Link>
        </Button>
      </div>
      <UpcomingTrainingForm />
    </div>
  );
}
