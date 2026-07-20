import type { ShiftColor } from "@/lib/shift-exchange-types";

/**
 * Shift color rotation rules (based on Shift Day start date).
 *
 * - 5/26-5/27 => Green
 * - 5/28-5/29 => Red
 * - 5/30-6/1  => Blue
 * and it repeats every 2 days.
 */
/** First shift-day block start (local 08:30 on this calendar date). */
export const SHIFT_DAY_ANCHOR_ISO = "2026-05-26";
export const SHIFT_DAY_START_HOUR = 8;
export const SHIFT_DAY_START_MINUTE = 30;
/** Each shift day spans 48 hours (08:30 to 08:30, two days later). */
export const SHIFT_BLOCK_MS = 48 * 60 * 60 * 1000;

const ROTATION: ShiftColor[] = ["Green", "Red", "Blue"]; // anchor maps to Green

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

  // Use UTC midnight to avoid local DST affecting the difference.
  const aMs = Date.UTC(a.y, a.m - 1, a.d);
  const bMs = Date.UTC(b.y, b.m - 1, b.d);
  return (aMs - bMs) / 86400000;
}

export function shiftColorForShiftDay(shiftDayStartIso: string): ShiftColor {
  const diffDays = daysDiffUTC(shiftDayStartIso, SHIFT_DAY_ANCHOR_ISO);
  if (diffDays === null) return "Green";

  const blockIndex = Math.floor(diffDays / 2); // 2-day window => one color slot
  const mod = ((blockIndex % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return ROTATION[mod];
}
