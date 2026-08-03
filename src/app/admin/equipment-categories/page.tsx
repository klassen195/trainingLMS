import Link from "next/link";
import { Tags } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingEquipmentCategoriesTable } from "@/lib/supabase/errors";
import {
  EQUIPMENT_CATEGORY_SELECT,
  type EquipmentCategory,
} from "@/lib/equipment-categories-types";
import { EquipmentCategoriesAdmin } from "@/components/EquipmentCategoriesAdmin";
import { Button } from "@/components/ui/Button";

export default async function AdminEquipmentCategoriesPage() {
  await requireCapability("manage_assets");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("equipment_categories")
    .select(EQUIPMENT_CATEGORY_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (isMissingEquipmentCategoriesTable(error)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Equipment categories</h1>
        <p className="text-muted-foreground">
          Database not set up yet. Run{" "}
          <code className="rounded bg-muted px-1">
            supabase/migrations/20260730400000_equipment_fields.sql
          </code>
          , then refresh this page.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    );
  }
  if (error) throw error;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Tags className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Equipment categories</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage the fixed category list used when adding equipment.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <EquipmentCategoriesAdmin categories={(data ?? []) as EquipmentCategory[]} />
    </div>
  );
}
