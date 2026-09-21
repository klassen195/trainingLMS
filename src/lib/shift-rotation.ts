/**
 * Shift color rotation — re-exports schedule helpers.
 * Prefer importing from `@/lib/shift-schedule` for new code.
 */
export {
  type ShiftColor,
  type ShiftScheduleConfig,
  DEFAULT_SHIFT_SCHEDULE,
  SHIFT_DAY_ANCHOR_ISO,
  SHIFT_DAY_START_HOUR,
  SHIFT_DAY_START_MINUTE,
  SHIFT_BLOCK_MS,
  shiftColorForShiftDay,
  shiftBlockMs,
} from "@/lib/shift-schedule";
