import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getDepartmentShiftScheduleSettings } from "@/app/admin/shift-schedule/actions";
import { DepartmentShiftScheduleForm } from "@/components/DepartmentShiftScheduleForm";
import { Button } from "@/components/ui/Button";

export default async function AdminShiftSchedulePage() {
  await requireAdmin();
  const settings = await getDepartmentShiftScheduleSettings();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <CalendarClock className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Shift schedule</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Choose your department&apos;s duty rotation and how platoons are named.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <DepartmentShiftScheduleForm initial={settings} />
    </div>
  );
}
