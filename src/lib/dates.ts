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
 * Display date as DD/MM/YYYY.
 * Calendar dates (`YYYY-MM-DD`) use the stored day (no timezone shift).
 * Datetimes use the local calendar day.
 */
export function formatDate(value: string | null | undefined, empty = "—") {
  if (!value) return empty;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return value;
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

/** Display datetime as DD/MM/YYYY HH:mm (local). */
export function formatDateTime(value: string | null | undefined, empty = "—") {
  if (!value) return empty;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

/** Display a Postgres/HTML time (`HH:MM` or `HH:MM:SS`) as HH:mm. */
export function formatTime(value: string | null | undefined, empty = "—") {
  if (!value) return empty;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  return `${pad2(Number(match[1]))}:${match[2]}`;
}

/** Normalize form/DB time strings to `HH:MM:SS`, or null if empty. */
export function normalizeTimeInput(value: string | null | undefined): string | null {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error("Invalid time.");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] != null ? Number(match[3]) : 0;
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    throw new Error("Invalid time.");
  }
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
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

/** Value suitable for `<input type="time">` (`HH:MM`). */
export function toTimeInputValue(value: string | null | undefined) {
  if (!value) return "";
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${pad2(Number(match[1]))}:${match[2]}`;
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
 * Blocks run 08:30 → 08:30 two calendar days later (e.g. 5/26 08:30–5/28 08:30 => 5/26).
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
 * Example: 2026-05-26 => "26/05-27/05"
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

  const startLabel = `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}`;
  const endLabel = `${pad2(end.getDate())}/${pad2(end.getMonth() + 1)}`;

  if (start.getFullYear() === end.getFullYear()) {
    return `${startLabel}-${endLabel}`;
  }

  return `${startLabel}/${start.getFullYear()}-${endLabel}/${end.getFullYear()}`;
}

export function formatTimestamp(iso: string) {
  return formatDateTime(iso, iso);
}
