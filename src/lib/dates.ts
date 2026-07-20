import {
  SHIFT_BLOCK_MS,
  SHIFT_DAY_ANCHOR_ISO,
  SHIFT_DAY_START_HOUR,
  SHIFT_DAY_START_MINUTE,
} from "@/lib/shift-rotation";

/** YYYY-MM-DD in local calendar (for form defaults). */
export function isoDateLocal(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${m}/${d}/${y}`;
}

/**
 * Shift Day is a 2-day window based on the stored `shift_date` (start day).
 * Example: 2026-05-26 => "5/26-5/27"
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

  const startM = start.getMonth() + 1;
  const startD = start.getDate();
  const endM = end.getMonth() + 1;
  const endD = end.getDate();

  if (start.getFullYear() === end.getFullYear()) {
    return `${startM}/${startD}-${endM}/${endD}`;
  }

  return `${startM}/${startD}/${start.getFullYear()}-${endM}/${endD}/${end.getFullYear()}`;
}

export function formatTimestamp(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const da = String(dt.getUTCDate()).padStart(2, "0");
  const h = String(dt.getUTCHours()).padStart(2, "0");
  const mi = String(dt.getUTCMinutes()).padStart(2, "0");
  return `${mo}/${da}/${y} ${h}:${mi}`;
}
