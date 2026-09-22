import Link from "next/link";
import { Truck } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { VehicleImportForm } from "@/components/VehicleImportForm";
import { Button } from "@/components/ui/Button";

export default async function VehicleImportPage() {
  await requireCapability("manage_assets");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assets")
    .select("build_number")
    .eq("kind", "apparatus")
    .not("build_number", "is", null);

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;

  const existingBuildNumbers = (data ?? [])
    .map((row) => row.build_number)
    .filter((value): value is string => Boolean(value?.trim()));

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Import vehicles</h1>
          </div>
          <p className="text-muted-foreground">
            Upload a CSV to create or update apparatus roster rows.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/assets/apparatus">Cancel</Link>
        </Button>
      </div>

      <VehicleImportForm existingBuildNumbers={existingBuildNumbers} />
    </div>
  );
}
