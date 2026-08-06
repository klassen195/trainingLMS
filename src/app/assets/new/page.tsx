import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import type { AssetKind } from "@/lib/assets-types";
import { listLocations } from "@/lib/locations";
import { listEquipmentCategories } from "@/lib/equipment-categories";
import { listEquipmentSubcategories } from "@/lib/equipment-subcategories";
import { AssetForm } from "@/components/AssetForm";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  await requireCapability("manage_assets");
  const { kind: kindParam } = await searchParams;
  const kind: AssetKind =
    kindParam === "apparatus" || kindParam === "ppe" ? kindParam : "ppe";

  const supabase = await createSupabaseServerClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;

  const { rows: locations, error: locationsError } = await listLocations(supabase, {
    activeOnly: true,
  });
  if (locationsError) throw locationsError;

  const { rows: equipmentCategories, error: categoriesError } =
    kind === "ppe"
      ? await listEquipmentCategories(supabase, { activeOnly: true })
      : { rows: [], error: null };
  if (categoriesError) throw categoriesError;

  const { rows: equipmentSubcategories, error: subcategoriesError } =
    kind === "ppe"
      ? await listEquipmentSubcategories(supabase, { activeOnly: true })
      : { rows: [], error: null };
  if (subcategoriesError) throw subcategoriesError;

  const { data: checkTemplates, error: templatesError } =
    kind === "apparatus"
      ? await supabase
          .from("vehicle_check_templates")
          .select("id, name, apparatus_type, is_type_default")
          .order("name", { ascending: true })
      : { data: [], error: null };
  if (templatesError) throw templatesError;

  const { data: apparatusOptions, error: apparatusError } =
    kind === "ppe"
      ? await supabase
          .from("assets")
          .select("id, name, unit_number, build_number")
          .eq("kind", "apparatus")
          .order("unit_number", { ascending: true, nullsFirst: false })
      : { data: [], error: null };
  if (apparatusError) throw apparatusError;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">New asset</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Add {kind === "ppe" ? "equipment" : "apparatus"} to the inventory.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={kind === "ppe" ? "/assets/ppe" : "/assets/apparatus"}>Cancel</Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={kind === "ppe" ? "primary" : "outline"} asChild>
          <Link href="/assets/new?kind=ppe">Equipment</Link>
        </Button>
        <Button variant={kind === "apparatus" ? "primary" : "outline"} asChild>
          <Link href="/assets/new?kind=apparatus">Apparatus</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-4 w-4" />
            {kind === "ppe" ? "Equipment details" : "Apparatus details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            mode="create"
            kind={kind}
            profiles={profiles ?? []}
            locations={locations}
            apparatusOptions={apparatusOptions ?? []}
            equipmentCategories={equipmentCategories}
            equipmentSubcategories={equipmentSubcategories}
            checkTemplates={checkTemplates ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
