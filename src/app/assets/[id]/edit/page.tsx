import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ASSET_SELECT, assetDisplayLabel, type Asset } from "@/lib/assets-types";
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
  await requireRole(["admin"]);
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
    .order("display_name", { ascending: true });

  if (profilesError) throw profilesError;

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
            {row.kind === "ppe" ? "PPE details" : "Apparatus details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            mode="edit"
            kind={row.kind}
            asset={row}
            profiles={profiles ?? []}
            checkTemplates={checkTemplates ?? []}
            assignedCheckTemplateIds={(assignedRows ?? []).map((row) => row.template_id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
