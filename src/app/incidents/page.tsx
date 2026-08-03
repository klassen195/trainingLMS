import Link from "next/link";
import { Siren, Plus } from "lucide-react";
import { requireCapability } from "@/lib/capability-access";
import { listIncidents } from "@/app/incidents/actions";
import { INCIDENT_TYPE_LABELS } from "@/lib/incident-types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default async function IncidentsPage() {
  await requireCapability("manage_incidents");
  const incidents = await listIncidents();
  const active = incidents.filter((i) => i.status === "active");
  const closed = incidents.filter((i) => i.status === "closed");

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <Siren className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">Incidents</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            ICS tactical boards: organize divisions, assign units, track work periods, and place resources on the map.
          </p>
        </div>
        <Button asChild>
          <Link href="/incidents/new">
            <Plus className="h-4 w-4" />
            New incident
          </Link>
        </Button>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Active</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active incidents.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {active.map((incident) => (
              <li key={incident.id}>
                <Link
                  href={`/incidents/${incident.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="font-medium">{incident.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {INCIDENT_TYPE_LABELS[incident.incident_type]}
                      {incident.location_text ? ` · ${incident.location_text}` : ""}
                    </p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Closed</h2>
          <ul className="divide-y rounded-md border">
            {closed.map((incident) => (
              <li key={incident.id}>
                <Link
                  href={`/incidents/${incident.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="font-medium">{incident.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {INCIDENT_TYPE_LABELS[incident.incident_type]}
                      {incident.location_text ? ` · ${incident.location_text}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">Closed</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
