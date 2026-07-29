import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingVehicleChecksTable } from "@/lib/supabase/errors";
import {
  VEHICLE_CHECK_TEMPLATE_ITEM_SELECT,
  VEHICLE_CHECK_TEMPLATE_SELECT,
  type VehicleCheckTemplate,
  type VehicleCheckTemplateItem,
} from "@/lib/vehicle-checks-types";
import { VehicleCheckTemplateSettings } from "@/components/VehicleCheckTemplateAdmin";
import { VehicleCheckTemplateEditor } from "@/components/VehicleCheckTemplateEditor";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apparatusTypeLabel } from "@/lib/labels";

export default async function AdminVehicleCheckTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: template, error } = await supabase
    .from("vehicle_check_templates")
    .select(VEHICLE_CHECK_TEMPLATE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (isMissingVehicleChecksTable(error)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Vehicle check template</h1>
        <p className="text-muted-foreground">Database not set up yet.</p>
      </div>
    );
  }
  if (error) throw error;
  if (!template) notFound();

  const row = template as VehicleCheckTemplate;

  const { data: items, error: itemsError } = await supabase
    .from("vehicle_check_template_items")
    .select(VEHICLE_CHECK_TEMPLATE_ITEM_SELECT)
    .eq("template_id", id)
    .order("sort_order", { ascending: true });

  if (itemsError) throw itemsError;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">{row.name}</h1>
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            {row.apparatus_type ? (
              <Badge variant="outline">{apparatusTypeLabel(row.apparatus_type)}</Badge>
            ) : (
              <Badge variant="outline">Any type</Badge>
            )}
            {row.is_type_default ? <Badge variant="secondary">Type default</Badge> : null}
            {row.checklist_kind === "swap" ? (
              <Badge variant="outline">Swap</Badge>
            ) : (
              <Badge variant="outline">Check</Badge>
            )}
          </div>
          <p className="text-lg text-muted-foreground">
            Edit sections and checklist items for this named template.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/vehicle-checks">All templates</Link>
        </Button>
      </div>

      <div className="mb-6">
        <VehicleCheckTemplateSettings template={row} />
      </div>

      <VehicleCheckTemplateEditor
        templateId={row.id}
        checklistIsCheck={row.checklist_kind === "check"}
        items={(items ?? []) as VehicleCheckTemplateItem[]}
      />
    </div>
  );
}
