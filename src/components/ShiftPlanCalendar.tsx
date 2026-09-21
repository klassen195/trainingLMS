"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { addCalendarDaysIso, isoDateLocal } from "@/lib/dates";
import { shiftColorDayClass } from "@/lib/shift-plan-types";
import { useShiftHelpers } from "@/components/ShiftScheduleProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseYearMonth(isoDate: string) {
  const [yStr, mStr] = isoDate.split("-");
  return { year: Number(yStr), month: Number(mStr) - 1 };
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { iso: string; inMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ iso: isoDateLocal(new Date(year, month, -i)), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: isoDateLocal(new Date(year, month, day)), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    cells.push({ iso: addCalendarDaysIso(last.iso, 1), inMonth: false });
  }
  return cells;
}

export function ShiftPlanCalendar({
  shiftDate,
  currentShiftDate,
}: {
  shiftDate: string;
  currentShiftDate: string;
}) {
  const { colorForDay, labelForColor, dayStartForCalendarDate, preset } = useShiftHelpers();
  const selected = parseYearMonth(shiftDate);
  const [browse, setBrowse] = useState<{ year: number; month: number } | null>(null);
  const year = browse?.year ?? selected.year;
  const month = browse?.month ?? selected.month;

  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const platoonNames = preset.platoons.map((c) => labelForColor(c)).join(", ");

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setBrowse({ year: next.getFullYear(), month: next.getMonth() });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">
          {MONTHS[month]} {year}
        </CardTitle>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1 font-medium">
              {day}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const blockStart = dayStartForCalendarDate(cell.iso);
            const color = colorForDay(blockStart);
            const label = labelForColor(color);
            const isSelected = blockStart === shiftDate;
            const isCurrent = blockStart === currentShiftDate;
            return (
              <Link
                key={cell.iso}
                href={`/shift-plan/${blockStart}`}
                className={cn(
                  "flex h-10 items-center justify-center rounded-md text-sm transition-colors",
                  shiftColorDayClass(color),
                  !cell.inMonth && "opacity-40",
                  isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  isCurrent && !isSelected && "font-bold"
                )}
                aria-current={isSelected ? "date" : undefined}
                title={`${cell.iso} · ${label}`}
              >
                {Number(cell.iso.slice(8))}
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Days are colored by the on-duty shift ({platoonNames}). Click a day to open that{" "}
          {preset.onDays === 1 ? "shift day" : `${preset.onDays * 24}-hour`} plan.
        </p>
      </CardContent>
    </Card>
  );
}
