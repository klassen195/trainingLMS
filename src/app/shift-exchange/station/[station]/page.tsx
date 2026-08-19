import { notFound, redirect } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingShiftExchangeTable, supabaseErrorMessage } from "@/lib/supabase/errors";
import { defaultShiftDateIso } from "@/lib/dates";
import { DatabaseSetup } from "@/components/DatabaseSetup";
import { MissingProfileSetup } from "@/components/MissingProfileSetup";
import { ShiftExchangeDatabaseSetup } from "@/components/ShiftExchangeDatabaseSetup";
import { RequestList, type ShiftExchangeRequestRow } from "@/components/RequestList";
import { ShiftExchangeForm } from "@/components/ShiftExchangeForm";
import { ShiftExchangeStationNav } from "@/components/ShiftExchangeStationNav";

function parseStation(param: string) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function stationLabel(stationNumber: number) {
  return `Station ${stationNumber}`;
}

export default async function ShiftExchangeStationPage({
  params,
}: {
  params: Promise<{ station: string }>;
}) {
  const auth = await getAuthContext();
  if (auth.kind === "unauthenticated") redirect("/login");
  if (auth.kind === "missing_tables") return <DatabaseSetup />;
  if (auth.kind === "missing_profile") return <MissingProfileSetup userId={auth.userId} />;

  const { station } = await params;
  const stationNumber = parseStation(station);
  if (!stationNumber) notFound();

  const supabase = await createSupabaseServerClient();
  const label = stationLabel(stationNumber);

  const { data: rows, error } = await supabase
    .from("shift_exchange_requests")
    .select(
      "id, created_at, category, shift_color, shift_date, request_notes, status, resolved_at, resolved_by, resolved_note"
    )
    .eq("station_or_unit", label)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingShiftExchangeTable(error)) return <ShiftExchangeDatabaseSetup />;
    throw new Error(supabaseErrorMessage(error));
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <ArrowLeftRight className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Shift Exchange</h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Submit notes and mark resolutions for {label}.
        </p>
      </div>

      <ShiftExchangeStationNav activeStation={stationNumber} />

      <header className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">{label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Shift exchange notes for this station.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr] xl:items-start">
        <ShiftExchangeForm stationLabel={label} defaultShiftDate={defaultShiftDateIso()} />
        <RequestList rows={(rows ?? []) as ShiftExchangeRequestRow[]} currentUserId={auth.profile.id} />
      </div>
    </div>
  );
}
