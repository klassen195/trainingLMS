import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingAssetsTable } from "@/lib/supabase/errors";
import type { AssetKind } from "@/lib/assets-types";
import { AssetForm } from "@/components/AssetForm";
import { AssetsDatabaseSetup } from "@/components/AssetsDatabaseSetup";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  await requireRole(["admin"]);
  const { kind: kindParam } = await searchParams;
  const kind: AssetKind =
    kindParam === "apparatus" || kindParam === "ppe" ? kindParam : "ppe";

  const supabase = await createSupabaseServerClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .order("display_name", { ascending: true });

  if (isMissingAssetsTable(error)) return <AssetsDatabaseSetup />;
  if (error) throw error;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">New asset</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Add {kind === "ppe" ? "PPE" : "apparatus"} to the inventory.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={kind === "ppe" ? "/assets/ppe" : "/assets/apparatus"}>Cancel</Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={kind === "ppe" ? "primary" : "outline"} asChild>
          <Link href="/assets/new?kind=ppe">PPE</Link>
        </Button>
        <Button variant={kind === "apparatus" ? "primary" : "outline"} asChild>
          <Link href="/assets/new?kind=apparatus">Apparatus</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-4 w-4" />
            {kind === "ppe" ? "PPE details" : "Apparatus details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm mode="create" kind={kind} profiles={profiles ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
