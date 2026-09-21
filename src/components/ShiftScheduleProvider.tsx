"use client";

import { createContext, useContext, useMemo } from "react";
import {
  addShiftBlocks,
  currentShiftDayStartIso,
  formatShiftDayRange,
  shiftBlockCalendarDays,
  shiftDayStartForCalendarDate,
} from "@/lib/dates";
import {
  DEFAULT_SHIFT_SCHEDULE,
  personnelShiftLabelForConfig,
  shiftColorForShiftDay,
  shiftColorLabel,
  shiftSchedulePreset,
  type ShiftColor,
  type ShiftScheduleConfig,
} from "@/lib/shift-schedule";

const ShiftScheduleContext = createContext<ShiftScheduleConfig>(DEFAULT_SHIFT_SCHEDULE);

export function ShiftScheduleProvider({
  config,
  children,
}: {
  config: ShiftScheduleConfig;
  children: React.ReactNode;
}) {
  return <ShiftScheduleContext.Provider value={config}>{children}</ShiftScheduleContext.Provider>;
}

export function useShiftSchedule() {
  return useContext(ShiftScheduleContext);
}

export function useShiftHelpers() {
  const config = useShiftSchedule();
  return useMemo(
    () => ({
      config,
      preset: shiftSchedulePreset(config.scheduleType),
      colorForDay: (iso: string) => shiftColorForShiftDay(iso, config),
      labelForColor: (color: ShiftColor | string | null | undefined) =>
        shiftColorLabel(color, config),
      labelForPersonnelShift: (shift: string | null | undefined) =>
        personnelShiftLabelForConfig(shift, config),
      formatDayRange: (iso: string) => formatShiftDayRange(iso, config),
      currentDayStart: (now?: Date) => currentShiftDayStartIso(now ?? new Date(), config),
      dayStartForCalendarDate: (iso: string) => shiftDayStartForCalendarDate(iso, config),
      addBlocks: (iso: string, blocks: number) => addShiftBlocks(iso, blocks, config),
      blockDays: (iso: string) => shiftBlockCalendarDays(iso, config),
    }),
    [config]
  );
}
