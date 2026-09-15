"use client";

import { useState } from "react";
import {
  createShiftPlanItem,
  updateShiftPlanItem,
  type ShiftPlanItemInput,
} from "@/app/shift-plan/actions";
import { formatDate, shiftBlockCalendarDays, toTimeInputValue } from "@/lib/dates";
import type { Location } from "@/lib/locations-types";
import type { ShiftPlanItem, ShiftPlanScope } from "@/lib/shift-plan-types";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function ShiftPlanItemForm({
  shiftDate,
  locations,
  item,
  onDone,
}: {
  shiftDate: string;
  locations: Location[];
  item?: ShiftPlanItem | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [scope, setScope] = useState<ShiftPlanScope>(item?.scope ?? "station");
  const [locationId, setLocationId] = useState(item?.location_id ?? locations[0]?.id ?? "");
  const [itemDate, setItemDate] = useState(item?.item_date ?? "");
  const [startTime, setStartTime] = useState(toTimeInputValue(item?.start_time));
  const [endTime, setEndTime] = useState(toTimeInputValue(item?.end_time));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dayOne, dayTwo] = shiftBlockCalendarDays(shiftDate);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload: ShiftPlanItemInput = {
      shiftDate,
      title,
      notes,
      scope,
      locationId: scope === "station" ? locationId : null,
      itemDate: itemDate || null,
      startTime: startTime || null,
      endTime: endTime || null,
    };
    try {
      if (item) {
        await updateShiftPlanItem({ ...payload, id: item.id });
      } else {
        await createShiftPlanItem(payload);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <FieldLabel htmlFor="sp-title">Title</FieldLabel>
        <Input
          id="sp-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hydrant testing"
        />
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="sp-scope">Scope</FieldLabel>
        <Select
          id="sp-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as ShiftPlanScope)}
        >
          <option value="battalion">Battalion-wide</option>
          <option value="station">Station</option>
        </Select>
      </div>

      {scope === "station" ? (
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="sp-station">Station</FieldLabel>
          <Select
            id="sp-station"
            required
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={locations.length === 0}
          >
            {locations.length === 0 ? <option value="">No stations</option> : null}
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="sp-item-date">Day (optional)</FieldLabel>
        <Select id="sp-item-date" value={itemDate} onChange={(e) => setItemDate(e.target.value)}>
          <option value="">Not specified</option>
          <option value={dayOne}>{formatDate(dayOne)}</option>
          <option value={dayTwo}>{formatDate(dayTwo)}</option>
        </Select>
        <FieldHint>Which calendar day of this 48-hour shift.</FieldHint>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="sp-start">Start</FieldLabel>
          <Input
            id="sp-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="sp-end">End</FieldLabel>
          <Input id="sp-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="sp-notes">Notes</FieldLabel>
        <Textarea
          id="sp-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-24"
          placeholder="Details (optional)"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={loading || (scope === "station" && !locationId)}>
          {loading ? "Saving..." : item ? "Save changes" : "Add to plan"}
        </Button>
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </form>
  );
}
