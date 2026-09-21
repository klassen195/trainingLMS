"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDepartmentShiftScheduleSettings } from "@/app/admin/shift-schedule/actions";
import { toTimeInputValue } from "@/lib/dates";
import {
  SHIFT_NAMING_STYLES,
  SHIFT_SCHEDULE_PRESETS,
  SHIFT_SCHEDULE_TYPES,
  shiftNamingStyleDescription,
  shiftNamingStyleLabel,
  shiftRotation,
  shiftColorLabel,
  type ShiftNamingStyle,
  type ShiftScheduleConfig,
  type ShiftScheduleType,
} from "@/lib/shift-schedule";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, FieldLabel, FieldSuccess } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { TimeInput } from "@/components/ui/TimeInput";

export function DepartmentShiftScheduleForm({
  initial,
}: {
  initial: ShiftScheduleConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scheduleType, setScheduleType] = useState<ShiftScheduleType>(initial.scheduleType);
  const [namingStyle, setNamingStyle] = useState<ShiftNamingStyle>(initial.namingStyle);
  const [anchorDate, setAnchorDate] = useState(initial.anchorDate);
  const [startTime, setStartTime] = useState(
    toTimeInputValue(
      `${String(initial.startHour).padStart(2, "0")}:${String(initial.startMinute).padStart(2, "0")}`
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const startHourParsed = Number.parseInt((startTime || "08:00").slice(0, 2), 10);
  const previewConfig: ShiftScheduleConfig = {
    scheduleType,
    namingStyle,
    anchorDate,
    startHour: Number.isFinite(startHourParsed) ? startHourParsed : 8,
    startMinute: 0,
  };
  const preset = SHIFT_SCHEDULE_PRESETS[scheduleType];
  const previewLabels = shiftRotation(previewConfig).map((color) =>
    shiftColorLabel(color, previewConfig)
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const normalized = toTimeInputValue(startTime);
    if (!normalized) {
      setError("Enter shift change time as HH:mm (24-hour).");
      return;
    }
    const hour = Number.parseInt(normalized.slice(0, 2), 10);
    startTransition(async () => {
      try {
        await updateDepartmentShiftScheduleSettings({
          scheduleType,
          namingStyle,
          anchorDate,
          startHour: hour,
        });
        setSuccess("Shift schedule saved.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save settings.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-lg border p-6">
      <div className="space-y-2">
        <FieldLabel htmlFor="shift-schedule-type">Schedule type</FieldLabel>
        <Select
          id="shift-schedule-type"
          value={scheduleType}
          onChange={(e) => setScheduleType(e.target.value as ShiftScheduleType)}
        >
          {SHIFT_SCHEDULE_TYPES.map((type) => (
            <option key={type} value={type}>
              {SHIFT_SCHEDULE_PRESETS[type].label} — {SHIFT_SCHEDULE_PRESETS[type].shortLabel}
            </option>
          ))}
        </Select>
        <FieldHint>{preset.description}</FieldHint>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="shift-naming-style">Naming style</FieldLabel>
        <Select
          id="shift-naming-style"
          value={namingStyle}
          onChange={(e) => setNamingStyle(e.target.value as ShiftNamingStyle)}
        >
          {SHIFT_NAMING_STYLES.map((style) => (
            <option key={style} value={style}>
              {shiftNamingStyleLabel(style)}
            </option>
          ))}
        </Select>
        <FieldHint>{shiftNamingStyleDescription(namingStyle)}</FieldHint>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel htmlFor="shift-anchor-date">Rotation anchor date</FieldLabel>
          <Input
            id="shift-anchor-date"
            type="date"
            required
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
          />
          <FieldHint>
            The first day of the first platoon ({previewLabels[0] ?? "A"}) in the rotation.
          </FieldHint>
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="shift-start-time">Shift change time</FieldLabel>
          <TimeInput
            id="shift-start-time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <FieldHint>When the oncoming shift starts (24-hour clock).</FieldHint>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
        <p className="font-medium">Preview</p>
        <p className="mt-1 text-muted-foreground">
          {preset.label} with {preset.platoons.length} platoons labeled{" "}
          {previewLabels.join(" → ")}. Tours last {preset.onDays} calendar day
          {preset.onDays === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save schedule"}
        </Button>
        {success ? <FieldSuccess>{success}</FieldSuccess> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </form>
  );
}
