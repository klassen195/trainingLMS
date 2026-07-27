"use client";

import { useState, useTransition } from "react";
import { createAssetInspection } from "@/app/assets/actions";
import type { InspectionResult } from "@/lib/assets-types";
import { inspectionResultLabel, inspectionResults } from "@/lib/labels";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function AssetInspectionForm({ assetId }: { assetId: string }) {
  const [result, setResult] = useState<InspectionResult>("pass");
  const [notes, setNotes] = useState("");
  const [nextDueOn, setNextDueOn] = useState("");
  const [inspectedAt, setInspectedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Log inspection</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await createAssetInspection({
                  assetId,
                  result,
                  notes,
                  next_due_on: nextDueOn || null,
                  inspected_at: inspectedAt
                    ? new Date(`${inspectedAt}T12:00:00`).toISOString()
                    : null,
                });
                setNotes("");
                setResult("pass");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong.");
              }
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="inspected_at">Inspection date</FieldLabel>
              <Input
                id="inspected_at"
                type="date"
                required
                value={inspectedAt}
                onChange={(e) => setInspectedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="result">Result</FieldLabel>
              <Select
                id="result"
                value={result}
                onChange={(e) => setResult(e.target.value as InspectionResult)}
              >
                {inspectionResults.map((r) => (
                  <option key={r} value={r}>
                    {inspectionResultLabel(r)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="next_due_on">Next due</FieldLabel>
            <Input
              id="next_due_on"
              type="date"
              value={nextDueOn}
              onChange={(e) => setNextDueOn(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="inspection_notes">Notes</FieldLabel>
            <Textarea
              id="inspection_notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <Button
            type="submit"
            variant="primary"
            disabled={pending}
            className="bg-[#C11B2B] text-white"
          >
            {pending ? "Saving..." : "Log inspection"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
