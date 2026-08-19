"use client";

import { useState } from "react";
import { createShiftExchangeRequest } from "@/app/shift-exchange/actions";
import { currentShiftDayStartIso, formatShiftDayRange } from "@/lib/dates";
import type { ShiftExchangeCategory } from "@/lib/shift-exchange-types";
import { shiftColorForShiftDay } from "@/lib/shift-rotation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldHint, FieldLabel, FieldSuccess } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

const categories: { value: ShiftExchangeCategory; label: string }[] = [
  { value: "station", label: "Station" },
  { value: "engine", label: "Engine" },
  { value: "boat", label: "Boat" },
  { value: "tech_rescue", label: "Tech Rescue" },
  { value: "events", label: "Events" },
  { value: "ems", label: "EMS" },
];

export function ShiftExchangeForm({
  stationLabel,
  defaultShiftDate,
}: {
  stationLabel: string;
  defaultShiftDate: string;
}) {
  const [category, setCategory] = useState<ShiftExchangeCategory>("station");
  const [shiftDate, setShiftDate] = useState(defaultShiftDate);
  const [requestNotes, setRequestNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await createShiftExchangeRequest({
        category,
        stationLabel,
        shiftDate,
        requestNotes: requestNotes.trim(),
      });
      setRequestNotes("");
      setShiftDate(currentShiftDayStartIso());
      setSuccess("Note submitted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit note");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">New note</CardTitle>
        <CardDescription>
          Submit a shift exchange note for the current shift day (based on today&apos;s date and time).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="sx-category">Category</FieldLabel>
            <Select
              id="sx-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ShiftExchangeCategory)}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <FieldLabel htmlFor="sx-shift">Shift</FieldLabel>
            <Input id="sx-shift" type="text" value={shiftColorForShiftDay(shiftDate)} readOnly />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel htmlFor="sx-shift-date">Shift day</FieldLabel>
            <Input
              id="sx-shift-date"
              type="date"
              required
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              suppressHydrationWarning
            />
            <FieldHint>Shift Set {formatShiftDayRange(shiftDate)}</FieldHint>
          </div>

          <div className="grid gap-1.5 md:col-span-2">
            <FieldLabel htmlFor="sx-notes">Notes</FieldLabel>
            <Textarea
              id="sx-notes"
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              className="min-h-24"
              placeholder="Details (optional)"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit note"}
            </Button>
            {success ? <FieldSuccess>{success}</FieldSuccess> : null}
            {error ? <FieldError>{error}</FieldError> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
