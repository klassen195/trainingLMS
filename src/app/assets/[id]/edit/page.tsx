import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { ASSET_SELECT, assetDisplayLabel, type Asset } from "@/lib/assets-types";
import { listLocations } from "@/lib/locations";
import { listEquipmentCategories } from "@/lib/equipment-categories";
import { listEquipmentSubcategories } from "@/lib/equipment-subcategories";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import { AssetForm } from "@/components/AssetForm";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("manage_assets");
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: asset, error } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;
  if (!asset) notFound();

  const row = asset as Asset;

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .or(
      row.assigned_to
        ? `is_active.eq.true,id.eq.${row.assigned_to}`
        : "is_active.eq.true"
    )
    .order("display_name", { ascending: true });

  if (profilesError) throw profilesError;

  const { rows: activeLocations, error: locationsError } = await listLocations(supabase, {
    activeOnly: true,
  });
  if (locationsError) throw locationsError;

  const locations =
    row.station && !activeLocations.some((location) => location.name === row.station)
      ? [
          ...activeLocations,
          {
            id: `inactive-${row.station}`,
            created_at: "",
            updated_at: "",
            name: row.station,
            sort_order: 9999,
            is_active: false,
            notes: "",
          },
        ]
      : activeLocations;

  const { rows: allCategories, error: categoriesError } =
    row.kind === "ppe"
      ? await listEquipmentCategories(supabase)
      : { rows: [], error: null };
  if (categoriesError) throw categoriesError;

  const equipmentCategories =
    row.kind === "ppe"
      ? allCategories.filter(
          (c) => c.is_active || c.id === row.equipment_category_id
        )
      : [];

  const { rows: allSubcategories, error: subcategoriesError } =
    row.kind === "ppe"
      ? await listEquipmentSubcategories(supabase)
      : { rows: [], error: null };
  if (subcategoriesError) throw subcategoriesError;

  const equipmentSubcategories =
    row.kind === "ppe"
      ? allSubcategories.filter(
          (s) => s.is_active || s.id === row.equipment_subcategory_id
        )
      : [];

  const { data: checkTemplates, error: templatesError } = await supabase
    .from("vehicle_check_templates")
    .select("id, name, apparatus_type, is_type_default")
    .order("name", { ascending: true });
  if (templatesError) throw templatesError;

  const { data: assignedRows, error: assignedError } = await supabase
    .from("asset_vehicle_check_templates")
    .select("template_id")
    .eq("asset_id", row.id)
    .order("sort_order", { ascending: true });
  if (assignedError) throw assignedError;

  const { data: apparatusOptions, error: apparatusError } =
    row.kind === "ppe"
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
            <h1 className="text-4xl font-bold">Edit asset</h1>
          </div>
          <p className="text-lg text-muted-foreground">{assetDisplayLabel(row)}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/assets/${row.id}`}>Cancel</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {row.kind === "ppe" ? "Equipment details" : "Apparatus details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            mode="edit"
            kind={row.kind}
            asset={row}
            profiles={profiles ?? []}
            locations={locations}
            apparatusOptions={apparatusOptions ?? []}
            equipmentCategories={equipmentCategories}
            equipmentSubcategories={equipmentSubcategories}
            checkTemplates={checkTemplates ?? []}
            assignedCheckTemplateIds={(assignedRows ?? []).map((row) => row.template_id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
