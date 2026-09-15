import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { TrainingAttendanceRequestForm } from "@/components/TrainingAttendanceRequestForm";
import { TrainingSectionNav } from "@/components/TrainingSectionNav";
import { Button } from "@/components/ui/Button";

export default async function NewTrainingRequestPage() {
  await requireCapability("document_training");

  return (
    <div className="container mx-auto px-4 py-5">
      <TrainingSectionNav pathname="/document-training/requests" />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Request unlisted training</h1>
          <p className="text-sm text-muted-foreground">
            Ask to attend an external course or conference that is not advertised here.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/document-training/requests">Back</Link>
        </Button>
      </div>
      <TrainingAttendanceRequestForm />
    </div>
  );
}
