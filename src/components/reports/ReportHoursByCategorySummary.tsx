"use client";

import { useMemo } from "react";
import { formatTrainingHours } from "@/lib/personnel-types";

const SLICE_COLORS = [
  "#0f766e", // teal-700
  "#1d4ed8", // blue-700
  "#b45309", // amber-700
  "#047857", // emerald-700
  "#9f1239", // rose-700
  "#4338ca", // indigo-700
  "#0e7490", // cyan-700
  "#a16207", // yellow-700
  "#be123c", // rose-700 alt
  "#334155", // slate-700
];

type CategorySlice = {
  name: string;
  hours: number;
  color: string;
};

function polarToCartesian(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function buildHoursByCategorySlices(
  rows: Record<string, unknown>[]
): { slices: CategorySlice[]; totalHours: number } {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const hours = Number(row.hours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const raw = row.category == null ? "" : String(row.category).trim();
    const name = raw || "Uncategorized";
    totals.set(name, (totals.get(name) ?? 0) + hours);
  }

  const slices = [...totals.entries()]
    .map(([name, hours], index) => ({
      name,
      hours: Math.round(hours * 100) / 100,
      color: SLICE_COLORS[index % SLICE_COLORS.length],
    }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));

  const totalHours = Math.round(slices.reduce((sum, slice) => sum + slice.hours, 0) * 100) / 100;
  return { slices, totalHours };
}

export function ReportHoursByCategorySummary({
  rows,
}: {
  rows: Record<string, unknown>[];
}) {
  const { slices, totalHours } = useMemo(() => buildHoursByCategorySlices(rows), [rows]);

  if (slices.length === 0) return null;

  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 74;
  let angle = -Math.PI / 2;

  const paths =
    slices.length === 1
      ? null
      : slices.map((slice) => {
          const sweep = (slice.hours / totalHours) * Math.PI * 2;
          const start = angle;
          const end = angle + sweep;
          angle = end;
          return {
            ...slice,
            d: describeArc(cx, cy, radius, start, end),
          };
        });

  return (
    <div className="flex flex-wrap items-center gap-8 rounded-lg border bg-muted/20 px-6 py-5">
      <div className="shrink-0 text-center">
        <p className="text-sm font-medium text-muted-foreground">Total hours</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
          {formatTrainingHours(totalHours)}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-6">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Hours by category"
          className="shrink-0"
        >
          {slices.length === 1 ? (
            <circle cx={cx} cy={cy} r={radius} fill={slices[0].color}>
              <title>
                {slices[0].name}: {formatTrainingHours(slices[0].hours)} hours
              </title>
            </circle>
          ) : (
            paths?.map((slice) => (
              <path key={slice.name} d={slice.d} fill={slice.color}>
                <title>
                  {slice.name}: {formatTrainingHours(slice.hours)} hours
                </title>
              </path>
            ))
          )}
        </svg>

        <ul className="min-w-0 flex-1 space-y-2">
          {slices.map((slice) => {
            const pct = totalHours > 0 ? Math.round((slice.hours / totalHours) * 100) : 0;
            return (
              <li key={slice.name} className="flex items-center gap-3 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatTrainingHours(slice.hours)}h · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
