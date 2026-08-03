import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingVehicleChecksTable } from "@/lib/supabase/errors";
import {
  VEHICLE_CHECK_TEMPLATE_SELECT,
  type VehicleCheckTemplate,
} from "@/lib/vehicle-checks-types";
import { CreateVehicleCheckTemplateForm } from "@/components/VehicleCheckTemplateAdmin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { apparatusTypeLabel } from "@/lib/labels";

export default async function AdminVehicleChecksPage() {
  await requireCapability("manage_vehicle_check_templates");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("vehicle_check_templates")
    .select(VEHICLE_CHECK_TEMPLATE_SELECT)
    .order("name", { ascending: true });

  if (isMissingVehicleChecksTable(error)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Vehicle check templates</h1>
        <p className="text-muted-foreground">
          Database not set up yet. Run the vehicle check migrations, then refresh this page.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    );
  }
  if (error) throw error;

  const templates = (data ?? []) as VehicleCheckTemplate[];

  const unitCounts = new Map<string, number>();
  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .select("id, apparatus_type")
    .eq("kind", "apparatus");
  if (assetsError) throw assetsError;

  const { data: assignments, error: assignmentsError } = await supabase
    .from("asset_vehicle_check_templates")
    .select("asset_id, template_id");
  if (assignmentsError) throw assignmentsError;

  const assignmentsByAsset = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const list = assignmentsByAsset.get(row.asset_id) ?? [];
    list.push(row.template_id);
    assignmentsByAsset.set(row.asset_id, list);
  }

  const typeDefaults = new Map<string, string[]>();
  for (const template of templates) {
    if (template.is_type_default && template.apparatus_type) {
      const list = typeDefaults.get(template.apparatus_type) ?? [];
      list.push(template.id);
      typeDefaults.set(template.apparatus_type, list);
    }
  }

  for (const asset of assets ?? []) {
    const explicit = assignmentsByAsset.get(asset.id);
    const resolvedIds =
      explicit && explicit.length > 0
        ? explicit
        : asset.apparatus_type
          ? typeDefaults.get(asset.apparatus_type) ?? []
          : [];
    for (const templateId of resolvedIds) {
      unitCounts.set(templateId, (unitCounts.get(templateId) ?? 0) + 1);
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Vehicle check templates</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Create named checklists, set type defaults, and assign multiple checklists per unit.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          {templates.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No templates yet. Create one on the right.
            </p>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {template.apparatus_type ? (
                        <Badge variant="outline">
                          {apparatusTypeLabel(template.apparatus_type)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Any type</Badge>
                      )}
                      {template.is_type_default ? (
                        <Badge variant="secondary">Type default</Badge>
                      ) : null}
                      {template.checklist_kind === "swap" ? (
                        <Badge variant="outline">Swap</Badge>
                      ) : (
                        <Badge variant="outline">Check</Badge>
                      )}
                      <Badge variant="outline">
                        {unitCounts.get(template.id) ?? 0} unit
                        {(unitCounts.get(template.id) ?? 0) === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">{template.name}</CardTitle>
                    {template.notes ? (
                      <p className="text-sm text-muted-foreground">{template.notes}</p>
                    ) : null}
                  </div>
                  <Button variant="outline" asChild>
                    <Link href={`/admin/vehicle-checks/${template.id}`}>Edit</Link>
                  </Button>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        <CreateVehicleCheckTemplateForm />
      </div>
    </div>
  );
}
