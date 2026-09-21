/**
 * Department fire shift schedule presets and display naming.
 *
 * Common U.S. career-fire patterns:
 * - 24/48 — 24 on, 48 off (3 platoons, ~56 hrs/week)
 * - 48/96 — 48 on, 96 off (3 platoons, ~56 hrs/week)
 * - 24/72 — 24 on, 72 off (4 platoons, ~42 hrs/week)
 */

export const SHIFT_SCHEDULE_TYPES = ["24_48", "48_96", "24_72"] as const;
export type ShiftScheduleType = (typeof SHIFT_SCHEDULE_TYPES)[number];

export const SHIFT_NAMING_STYLES = ["colors", "letters", "numbers"] as const;
export type ShiftNamingStyle = (typeof SHIFT_NAMING_STYLES)[number];

/** Calendar / plan color keys stored in the DB (`shift_color`). */
export type ShiftColor = "Red" | "Green" | "Blue" | "White";

export type ShiftScheduleConfig = {
  scheduleType: ShiftScheduleType;
  namingStyle: ShiftNamingStyle;
  /** ISO date (YYYY-MM-DD) for the first on-duty block of the first platoon. */
  anchorDate: string;
  startHour: number;
  startMinute: number;
};

export type ShiftSchedulePreset = {
  type: ShiftScheduleType;
  label: string;
  shortLabel: string;
  description: string;
  /** Consecutive calendar days on duty per tour. */
  onDays: number;
  /** Platoons in rotation order (anchor date maps to index 0). */
  platoons: readonly ShiftColor[];
};

export const DEFAULT_SHIFT_SCHEDULE: ShiftScheduleConfig = {
  scheduleType: "48_96",
  namingStyle: "colors",
  anchorDate: "2026-05-26",
  startHour: 8,
  startMinute: 0,
};

/** @deprecated Prefer DEFAULT_SHIFT_SCHEDULE.anchorDate */
export const SHIFT_DAY_ANCHOR_ISO = DEFAULT_SHIFT_SCHEDULE.anchorDate;
/** @deprecated Prefer DEFAULT_SHIFT_SCHEDULE.startHour */
export const SHIFT_DAY_START_HOUR = DEFAULT_SHIFT_SCHEDULE.startHour;
/** @deprecated Prefer DEFAULT_SHIFT_SCHEDULE.startMinute */
export const SHIFT_DAY_START_MINUTE = DEFAULT_SHIFT_SCHEDULE.startMinute;

export const SHIFT_SCHEDULE_PRESETS: Record<ShiftScheduleType, ShiftSchedulePreset> = {
  "24_48": {
    type: "24_48",
    label: "24/48",
    shortLabel: "24 on / 48 off",
    description: "One day on, two days off. Three platoons; most common career-fire schedule (~56 hrs/week).",
    onDays: 1,
    platoons: ["Green", "Red", "Blue"],
  },
  "48_96": {
    type: "48_96",
    label: "48/96",
    shortLabel: "48 on / 96 off",
    description: "Two days on, four days off. Three platoons; same average hours as 24/48 with longer breaks.",
    onDays: 2,
    platoons: ["Green", "Red", "Blue"],
  },
  "24_72": {
    type: "24_72",
    label: "24/72",
    shortLabel: "24 on / 72 off",
    description: "One day on, three days off. Four platoons; lower average hours (~42 hrs/week).",
    onDays: 1,
    platoons: ["Green", "Red", "Blue", "White"],
  },
};

export function isShiftScheduleType(value: string): value is ShiftScheduleType {
  return (SHIFT_SCHEDULE_TYPES as readonly string[]).includes(value);
}

export function isShiftNamingStyle(value: string): value is ShiftNamingStyle {
  return (SHIFT_NAMING_STYLES as readonly string[]).includes(value);
}

export function isShiftColor(value: string): value is ShiftColor {
  return value === "Red" || value === "Green" || value === "Blue" || value === "White";
}

export function shiftSchedulePreset(type: ShiftScheduleType = DEFAULT_SHIFT_SCHEDULE.scheduleType) {
  return SHIFT_SCHEDULE_PRESETS[type];
}

export function shiftScheduleTypeLabel(type: ShiftScheduleType) {
  return SHIFT_SCHEDULE_PRESETS[type].label;
}

export function shiftNamingStyleLabel(style: ShiftNamingStyle) {
  switch (style) {
    case "colors":
      return "Colors (Red / Green / Blue)";
    case "letters":
      return "Letters (A / B / C)";
    case "numbers":
      return "Numbers (1 / 2 / 3)";
  }
}

export function shiftNamingStyleDescription(style: ShiftNamingStyle) {
  switch (style) {
    case "colors":
      return "Platoons are named by color on calendars and personnel files.";
    case "letters":
      return "Platoons are labeled A, B, C (and D on four-platoon schedules).";
    case "numbers":
      return "Platoons are labeled 1, 2, 3 (and 4 on four-platoon schedules).";
  }
}

export function shiftBlockDays(config: ShiftScheduleConfig = DEFAULT_SHIFT_SCHEDULE) {
  return shiftSchedulePreset(config.scheduleType).onDays;
}

export function shiftBlockMs(config: ShiftScheduleConfig = DEFAULT_SHIFT_SCHEDULE) {
  return shiftBlockDays(config) * 24 * 60 * 60 * 1000;
}

/** @deprecated Prefer shiftBlockMs(config) */
export const SHIFT_BLOCK_MS = shiftBlockMs(DEFAULT_SHIFT_SCHEDULE);

export function shiftRotation(config: ShiftScheduleConfig = DEFAULT_SHIFT_SCHEDULE): readonly ShiftColor[] {
  return shiftSchedulePreset(config.scheduleType).platoons;
}

function parseIsoDate(isoDate: string) {
  const [yStr, mStr, dStr] = isoDate.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m, d };
}

function daysDiffUTC(aIso: string, bIso: string) {
  const a = parseIsoDate(aIso);
  const b = parseIsoDate(bIso);
  if (!a || !b) return null;
  const aMs = Date.UTC(a.y, a.m - 1, a.d);
  const bMs = Date.UTC(b.y, b.m - 1, b.d);
  return (aMs - bMs) / 86400000;
}

export function shiftColorForShiftDay(
  shiftDayStartIso: string,
  config: ShiftScheduleConfig = DEFAULT_SHIFT_SCHEDULE
): ShiftColor {
  const rotation = shiftRotation(config);
  const onDays = shiftBlockDays(config);
  const diffDays = daysDiffUTC(shiftDayStartIso, config.anchorDate);
  if (diffDays === null) return rotation[0];

  const blockIndex = Math.floor(diffDays / onDays);
  const mod = ((blockIndex % rotation.length) + rotation.length) % rotation.length;
  return rotation[mod];
}

/**
 * Display label for a calendar/plan color under the department naming style.
 * Rotation order drives A/B/C and 1/2/3 (anchor platoon is A / 1).
 */
export function shiftColorLabel(
  color: ShiftColor | string | null | undefined,
  config: ShiftScheduleConfig = DEFAULT_SHIFT_SCHEDULE
) {
  if (!color) return "—";
  if (!isShiftColor(color)) return color;

  if (config.namingStyle === "colors") return color;

  const rotation = shiftRotation(config);
  const idx = rotation.indexOf(color);
  if (idx < 0) {
    // e.g. White on a 3-platoon schedule (admin / day staff)
    return color;
  }
  if (config.namingStyle === "letters") {
    return String.fromCharCode(65 + idx);
  }
  return String(idx + 1);
}

/** Personnel `profiles.shift` value ↔ calendar ShiftColor. */
export function personnelShiftToColor(shift: string | null | undefined): ShiftColor | null {
  if (!shift) return null;
  const mapped = shift.charAt(0).toUpperCase() + shift.slice(1).toLowerCase();
  return isShiftColor(mapped) ? mapped : null;
}

export function shiftColorToPersonnelShift(color: ShiftColor): "red" | "blue" | "green" | "white" {
  return color.toLowerCase() as "red" | "blue" | "green" | "white";
}

/** Line platoons for this schedule, plus White for admin/day staff when not already included. */
export function personnelShiftsForSchedule(config: ShiftScheduleConfig = DEFAULT_SHIFT_SCHEDULE) {
  const fromRotation = shiftRotation(config).map(shiftColorToPersonnelShift);
  if (fromRotation.includes("white")) return fromRotation;
  return [...fromRotation, "white" as const];
}

export function personnelShiftLabelForConfig(
  shift: string | null | undefined,
  config: ShiftScheduleConfig = DEFAULT_SHIFT_SCHEDULE
) {
  if (!shift) return "—";
  const color = personnelShiftToColor(shift);
  if (!color) return shift.charAt(0).toUpperCase() + shift.slice(1);
  if (shift === "white" && !shiftRotation(config).includes("White")) {
    return "White";
  }
  return shiftColorLabel(color, config);
}

export function parseShiftScheduleConfig(row: {
  shift_schedule_type?: string | null;
  shift_naming_style?: string | null;
  shift_day_anchor_date?: string | null;
  shift_day_start_hour?: number | null;
} | null | undefined): ShiftScheduleConfig {
  if (!row) return { ...DEFAULT_SHIFT_SCHEDULE };

  let scheduleType: ShiftScheduleType = DEFAULT_SHIFT_SCHEDULE.scheduleType;
  if (typeof row.shift_schedule_type === "string" && isShiftScheduleType(row.shift_schedule_type)) {
    scheduleType = row.shift_schedule_type;
  }
  let namingStyle: ShiftNamingStyle = DEFAULT_SHIFT_SCHEDULE.namingStyle;
  if (typeof row.shift_naming_style === "string" && isShiftNamingStyle(row.shift_naming_style)) {
    namingStyle = row.shift_naming_style;
  }
  const anchorDate =
    typeof row.shift_day_anchor_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(row.shift_day_anchor_date)
      ? row.shift_day_anchor_date.slice(0, 10)
      : DEFAULT_SHIFT_SCHEDULE.anchorDate;
  const startHour =
    typeof row.shift_day_start_hour === "number" &&
    Number.isFinite(row.shift_day_start_hour) &&
    row.shift_day_start_hour >= 0 &&
    row.shift_day_start_hour <= 23
      ? Math.trunc(row.shift_day_start_hour)
      : DEFAULT_SHIFT_SCHEDULE.startHour;

  return {
    scheduleType,
    namingStyle,
    anchorDate,
    startHour,
    startMinute: DEFAULT_SHIFT_SCHEDULE.startMinute,
  };
}
