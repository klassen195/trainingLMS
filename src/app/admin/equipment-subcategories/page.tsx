import Link from "next/link";
import { ListTree } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingEquipmentCategoriesTable,
  isMissingEquipmentSubcategoriesTable,
} from "@/lib/supabase/errors";
import {
  EQUIPMENT_CATEGORY_SELECT,
  type EquipmentCategory,
} from "@/lib/equipment-categories-types";
import { listEquipmentSubcategories } from "@/lib/equipment-subcategories";
import { EquipmentSubcategoriesAdmin } from "@/components/EquipmentSubcategoriesAdmin";
import { Button } from "@/components/ui/Button";

export default async function AdminEquipmentSubcategoriesPage() {
  await requireCapability("manage_assets");
  const supabase = await createSupabaseServerClient();

  const { data: categories, error: categoriesError } = await supabase
    .from("equipment_categories")
    .select(EQUIPMENT_CATEGORY_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (isMissingEquipmentCategoriesTable(categoriesError)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Equipment subcategories</h1>
        <p className="text-muted-foreground">
          Equipment categories are not set up yet. Create categories first, then add
          subcategories.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/admin/equipment-categories">Manage categories</Link>
        </Button>
      </div>
    );
  }
  if (categoriesError) throw categoriesError;

  const { rows: subcategories, error: subcategoriesError } = await listEquipmentSubcategories(
    supabase,
    { withCategory: true }
  );

  if (isMissingEquipmentSubcategoriesTable(subcategoriesError)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Equipment subcategories</h1>
        <p className="text-muted-foreground">
          Database not set up yet. Run{" "}
          <code className="rounded bg-muted px-1">
            supabase/migrations/20260730410000_equipment_subcategories.sql
          </code>
          , then refresh this page.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    );
  }
  if (subcategoriesError) throw subcategoriesError;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <ListTree className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Equipment subcategories</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage subcategories under each equipment category.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/equipment-categories">Categories</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin">Back to admin</Link>
          </Button>
        </div>
      </div>

      <EquipmentSubcategoriesAdmin
        subcategories={subcategories}
        categories={(categories ?? []) as EquipmentCategory[]}
      />
    </div>
  );
}
