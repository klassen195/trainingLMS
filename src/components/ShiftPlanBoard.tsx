"use client";

import type { Location } from "@/lib/locations-types";
import type { ShiftPlanItem } from "@/lib/shift-plan-types";
import { ShiftPlanAgenda } from "@/components/ShiftPlanAgenda";
import { ShiftPlanCalendar } from "@/components/ShiftPlanCalendar";

export function ShiftPlanBoard({
  shiftDate,
  currentShiftDate,
  items,
  locations,
}: {
  shiftDate: string;
  currentShiftDate: string;
  items: ShiftPlanItem[];
  locations: Location[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,380px)_1fr] xl:items-start">
      <ShiftPlanCalendar key={shiftDate} shiftDate={shiftDate} currentShiftDate={currentShiftDate} />
      <ShiftPlanAgenda
        shiftDate={shiftDate}
        currentShiftDate={currentShiftDate}
        items={items}
        locations={locations}
      />
    </div>
  );
}
