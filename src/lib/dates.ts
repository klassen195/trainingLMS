import {
  SHIFT_BLOCK_MS,
  SHIFT_DAY_ANCHOR_ISO,
  SHIFT_DAY_START_HOUR,
  SHIFT_DAY_START_MINUTE,
} from "@/lib/shift-rotation";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD in local calendar (for form defaults). */
export function isoDateLocal(d: Date) {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Display date as MM/DD/YYYY.
 * Calendar dates (`YYYY-MM-DD`) use the stored day (no timezone shift).
 * Datetimes use the local calendar day.
 */
export function formatDate(value: string | null | undefined, empty = "—") {
  if (!value) return empty;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    return `${m}/${d}/${y}`;
  }
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return value;
  return `${pad2(dt.getMonth() + 1)}/${pad2(dt.getDate())}/${dt.getFullYear()}`;
}

/** Display datetime as MM/DD/YYYY HH:mm (24-hour, local). */
export function formatDateTime(value: string | null | undefined, empty = "—") {
  if (!value) return empty;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return `${pad2(dt.getMonth() + 1)}/${pad2(dt.getDate())}/${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

/** Display a Postgres/HTML time (`HH:MM` or `HH:MM:SS`) as 24-hour HH:mm. */
export function formatTime(value: string | null | undefined, empty = "—") {
  if (!value) return empty;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  return `${pad2(Number(match[1]))}:${match[2]}`;
}

function isValidClockTime(hours: number, minutes: number, seconds: number) {
  return (
    Number.isFinite(hours) &&
    Number.isFinite(minutes) &&
    Number.isFinite(seconds) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59 &&
    seconds >= 0 &&
    seconds <= 59
  );
}

/**
 * Parse flexible 24-hour time entry: `HH:mm`, `HH:mm:ss`, or compact military (`0800`, `800`, `8`).
 * Returns null when empty or unparseable.
 */
function parseFlexibleTime(
  value: string | null | undefined
): { hours: number; minutes: number; seconds: number } | null {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;

  const withColons = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (withColons) {
    const hours = Number(withColons[1]);
    const minutes = Number(withColons[2]);
    const seconds = withColons[3] != null ? Number(withColons[3]) : 0;
    if (!isValidClockTime(hours, minutes, seconds)) return null;
    return { hours, minutes, seconds };
  }

  // Compact military / digits only: 0800 → 08:00, 830 → 08:30, 8 → 08:00
  const digits = trimmed.replace(/[\s.-]/g, "");
  if (!/^\d{1,4}$/.test(digits)) return null;

  let hours: number;
  let minutes: number;
  if (digits.length <= 2) {
    hours = Number(digits);
    minutes = 0;
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  }

  if (!isValidClockTime(hours, minutes, 0)) return null;
  return { hours, minutes, seconds: 0 };
}

/** Normalize form/DB time strings to `HH:MM:SS`, or null if empty. */
export function normalizeTimeInput(value: string | null | undefined): string | null {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  const parsed = parseFlexibleTime(trimmed);
  if (!parsed) throw new Error("Invalid time.");
  return `${pad2(parsed.hours)}:${pad2(parsed.minutes)}:${pad2(parsed.seconds)}`;
}

/** Hours between two times (`HH:MM` / `HH:MM:SS`), rounded to 2 decimals. */
export function hoursBetweenTimes(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): number | null {
  let start: string | null;
  let end: string | null;
  try {
    start = normalizeTimeInput(startTime);
    end = normalizeTimeInput(endTime);
  } catch {
    return null;
  }
  if (!start || !end || end <= start) return null;

  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };

  return Math.round(((toMinutes(end) - toMinutes(start)) / 60) * 100) / 100;
}

/** Value suitable for time text inputs (`HH:MM`). Accepts `HH:mm` or compact military (`0800`). */
export function toTimeInputValue(value: string | null | undefined) {
  const parsed = parseFlexibleTime(value);
  if (!parsed) return "";
  return `${pad2(parsed.hours)}:${pad2(parsed.minutes)}`;
}

function shiftDayAnchorLocal() {
  const [yStr, mStr, dStr] = SHIFT_DAY_ANCHOR_ISO.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  return new Date(y, m - 1, d, SHIFT_DAY_START_HOUR, SHIFT_DAY_START_MINUTE, 0, 0);
}

/**
 * Shift day start for the current local date/time.
 * Blocks run 08:00 → 08:00 two calendar days later (e.g. 5/26 08:00–5/28 08:00 => 5/26).
 */
export function currentShiftDayStartIso(now = new Date()) {
  const anchor = shiftDayAnchorLocal();
  const elapsed = now.getTime() - anchor.getTime();
  const blockIndex = Math.floor(elapsed / SHIFT_BLOCK_MS);
  const blockStart = new Date(anchor.getTime() + blockIndex * SHIFT_BLOCK_MS);
  return isoDateLocal(blockStart);
}

export function defaultShiftDateIso() {
  return currentShiftDayStartIso();
}

/** Stable display (no locale) — avoids SSR/client hydration mismatches. */
export function formatShiftDate(isoDate: string) {
  return formatDate(isoDate, isoDate);
}

/**
 * Shift Day is a 2-day window based on the stored `shift_date` (start day).
 * Example: 2026-05-26 => "05/26-05/27"
 */
export function formatShiftDayRange(startIso: string) {
  const [yStr, mStr, dStr] = startIso.split("-");
  if (!yStr || !mStr || !dStr) return startIso;

  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return startIso;

  // Use local calendar math (matches how `isoDateLocal` is produced).
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  const startLabel = `${pad2(start.getMonth() + 1)}/${pad2(start.getDate())}`;
  const endLabel = `${pad2(end.getMonth() + 1)}/${pad2(end.getDate())}`;

  if (start.getFullYear() === end.getFullYear()) {
    return `${startLabel}-${endLabel}`;
  }

  return `${startLabel}/${start.getFullYear()}-${endLabel}/${end.getFullYear()}`;
}

export function formatTimestamp(iso: string) {
  return formatDateTime(iso, iso);
}

export function isIsoDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yStr, mStr, dStr] = value.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function addCalendarDaysIso(isoDate: string, days: number) {
  const [yStr, mStr, dStr] = isoDate.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return isoDate;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDateLocal(dt);
}

/**
 * Shift-day start that owns this calendar date at local noon.
 * Both labeled days of a 48-hour block map to the same start date.
 */
export function shiftDayStartForCalendarDate(isoDate: string) {
  const [yStr, mStr, dStr] = isoDate.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return isoDate;
  return currentShiftDayStartIso(new Date(y, m - 1, d, 12, 0, 0, 0));
}

export function addShiftBlocks(shiftDayStartIso: string, blocks: number) {
  return addCalendarDaysIso(shiftDayStartIso, blocks * 2);
}

export function shiftBlockCalendarDays(shiftDayStartIso: string): [string, string] {
  return [shiftDayStartIso, addCalendarDaysIso(shiftDayStartIso, 1)];
}
