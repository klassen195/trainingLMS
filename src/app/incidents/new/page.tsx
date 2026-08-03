import Link from "next/link";
import { requireCapability } from "@/lib/capability-access";
import { createIncident } from "@/app/incidents/actions";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_WORK_PERIOD_MINUTES,
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPES,
} from "@/lib/incident-types";
import { Button } from "@/components/ui/Button";
import { FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

export default async function NewIncidentPage() {
  await requireCapability("manage_incidents");

  return (
    <div className="container mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">New incident</h1>
      <p className="mb-8 text-muted-foreground">
        Create a tactical board. You can add divisions, units, and map placements after opening it.
      </p>

      <form action={createIncident} className="space-y-5">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="name">Incident name</FieldLabel>
          <Input id="name" name="name" required placeholder="e.g. Main St Structure" />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="incident_type">Type</FieldLabel>
          <Select id="incident_type" name="incident_type" defaultValue="structure_fire">
            {INCIDENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {INCIDENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="location_text">Location</FieldLabel>
          <Input id="location_text" name="location_text" placeholder="Address or landmark" />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="default_work_period_minutes">Default work period (minutes)</FieldLabel>
          <Input
            id="default_work_period_minutes"
            name="default_work_period_minutes"
            type="number"
            min={1}
            defaultValue={DEFAULT_WORK_PERIOD_MINUTES}
          />
          <FieldHint>Countdown resets when a unit is assigned or renewed.</FieldHint>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="map_center_lng">Map longitude</FieldLabel>
            <Input
              id="map_center_lng"
              name="map_center_lng"
              type="number"
              step="any"
              defaultValue={DEFAULT_MAP_CENTER.lng}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="map_center_lat">Map latitude</FieldLabel>
            <Input
              id="map_center_lat"
              name="map_center_lat"
              type="number"
              step="any"
              defaultValue={DEFAULT_MAP_CENTER.lat}
            />
          </div>
        </div>
        <input type="hidden" name="map_zoom" value={DEFAULT_MAP_ZOOM} />
        <FieldHint>Defaults to the Kootenai County area. Pan the map later to refine.</FieldHint>

        <div className="flex gap-3 pt-2">
          <Button type="submit">Create incident</Button>
          <Button asChild variant="outline">
            <Link href="/incidents">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
