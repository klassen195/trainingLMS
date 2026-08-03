import Link from "next/link";
import { MapPin } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingLocationsTable } from "@/lib/supabase/errors";
import { LOCATION_SELECT, type Location } from "@/lib/locations-types";
import { LocationsAdmin } from "@/components/LocationsAdmin";
import { Button } from "@/components/ui/Button";

export default async function AdminLocationsPage() {
  await requireCapability("manage_locations");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("locations")
    .select(LOCATION_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (isMissingLocationsTable(error)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold">Locations</h1>
        <p className="text-muted-foreground">
          Database not set up yet. Run the locations migration, then refresh this page.
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
            <MapPin className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Locations</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage stations and other sites used when assigning assets.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <LocationsAdmin locations={(data ?? []) as Location[]} />
    </div>
  );
}
