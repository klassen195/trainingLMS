import Link from "next/link";
import { HardHat } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { EquipmentImportForm } from "@/components/EquipmentImportForm";
import { Button } from "@/components/ui/Button";

export default async function EquipmentImportPage() {
  await requireCapability("manage_assets");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assets")
    .select("name")
    .eq("kind", "ppe")
    .not("name", "is", null);

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;

  const existingEquipmentIds = (data ?? [])
    .map((row) => row.name)
    .filter((name): name is string => Boolean(name?.trim()));

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <HardHat className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Import equipment</h1>
          </div>
          <p className="text-muted-foreground">
            Upload a CSV to create or update equipment inventory rows.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/assets/ppe">Cancel</Link>
        </Button>
      </div>

      <EquipmentImportForm existingEquipmentIds={existingEquipmentIds} />
    </div>
  );
}
