"use client";

import type { FlagLevel } from "@/lib/home-dashboard-types";
import { flagLevelLabel } from "@/lib/home-dashboard-types";
import { cn } from "@/lib/cn";

const METER_LEVELS: Exclude<FlagLevel, "unset">[] = [
  "low",
  "moderate",
  "high",
  "very_high",
  "extreme",
];

const SEGMENT = 180 / METER_LEVELS.length;

const COLORS: Record<Exclude<FlagLevel, "unset">, string> = {
  low: "#2E7D32",
  moderate: "#1565C0",
  high: "#F9A825",
  very_high: "#EF6C00",
  extreme: "#C62828",
};

const LABEL_FILL: Record<Exclude<FlagLevel, "unset">, string> = {
  low: "#ffffff",
  moderate: "#ffffff",
  high: "#1a1a1a",
  very_high: "#ffffff",
  extreme: "#ffffff",
};

const CX = 160;
const CY = 158;
const R_OUTER = 138;

const DISK_FILL = `conic-gradient(from 270deg, ${METER_LEVELS.map((level, index) => {
  const start = index * SEGMENT;
  const end = (index + 1) * SEGMENT;
  return `${COLORS[level]} ${start}deg ${end}deg`;
}).join(", ")}, transparent 180deg 360deg)`;

function polar(radius: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: CX + radius * Math.cos(rad),
    y: CY - radius * Math.sin(rad),
  };
}

function wedgePath(startDeg: number, endDeg: number) {
  const start = polar(R_OUTER, startDeg);
  const end = polar(R_OUTER, endDeg);
  return [
    `M ${CX} ${CY}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${R_OUTER} ${R_OUTER} 0 0 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function needleAngle(level: FlagLevel) {
  if (level === "unset") return 188;
  const index = METER_LEVELS.indexOf(level);
  const start = 180 - index * SEGMENT;
  return start - SEGMENT / 2;
}

function needlePoints(level: FlagLevel) {
  const angle = needleAngle(level);
  const rad = (angle * Math.PI) / 180;
  const perp = rad + Math.PI / 2;
  const length = R_OUTER - 8;
  const base = 14;
  const half = 7;
  const bx = CX + base * Math.cos(rad);
  const by = CY - base * Math.sin(rad);
  const tip = polar(length, angle);
  const lx = bx + half * Math.cos(perp);
  const ly = by - half * Math.sin(perp);
  const rx = bx - half * Math.cos(perp);
  const ry = by + half * Math.sin(perp);
  return `${lx.toFixed(1)},${ly.toFixed(1)} ${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${rx.toFixed(1)},${ry.toFixed(1)}`;
}

function segmentLabel(level: Exclude<FlagLevel, "unset">) {
  if (level === "very_high") return ["VERY", "HIGH"];
  if (level === "moderate") return ["MODERATE"];
  return [flagLevelLabel(level).toUpperCase()];
}

export function FireDangerMeter({
  level,
  canEdit = false,
  onSelect,
}: {
  level: FlagLevel;
  canEdit?: boolean;
  onSelect?: (level: FlagLevel) => void;
}) {
  const left = polar(R_OUTER, 180);
  const right = polar(R_OUTER, 0);

  return (
    <div className="relative mx-auto w-full max-w-[22rem] overflow-hidden" style={{ aspectRatio: "320 / 178" }}>
      <div
        className="absolute rounded-full"
        style={{
          left: `${((CX - R_OUTER) / 320) * 100}%`,
          top: `${((CY - R_OUTER) / 178) * 100}%`,
          width: `${((R_OUTER * 2) / 320) * 100}%`,
          height: `${((R_OUTER * 2) / 178) * 100}%`,
          background: DISK_FILL,
        }}
      />
      <svg
        viewBox="0 0 320 178"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`Fire danger ${flagLevelLabel(level)}`}
      >
        <title>Fire danger {flagLevelLabel(level)}</title>
        {METER_LEVELS.map((segment, index) => {
          const start = 180 - index * SEGMENT;
          const end = start - SEGMENT;
          return (
            <path
              key={segment}
              d={wedgePath(start, end)}
              fill="transparent"
              className={cn(canEdit && onSelect && "cursor-pointer")}
              onClick={canEdit && onSelect ? () => onSelect(segment) : undefined}
            />
          );
        })}
        {METER_LEVELS.slice(1).map((_, index) => {
          const deg = 180 - (index + 1) * SEGMENT;
          const rim = polar(R_OUTER, deg);
          return (
            <line
              key={deg}
              x1={CX}
              y1={CY}
              x2={rim.x}
              y2={rim.y}
              stroke="#111"
              strokeWidth="1"
            />
          );
        })}
        {METER_LEVELS.map((segment, index) => {
          const start = 180 - index * SEGMENT;
          const mid = start - SEGMENT / 2;
          const labelPos = polar(R_OUTER * 0.68, mid);
          const lines = segmentLabel(segment);
          return (
            <text
              key={`${segment}-label`}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              fill={LABEL_FILL[segment]}
              className="pointer-events-none select-none"
              style={{ fontSize: segment === "moderate" || segment === "very_high" ? 9 : 11, fontWeight: 800 }}
            >
              {lines.map((line, lineIndex) => (
                <tspan
                  key={line}
                  x={labelPos.x}
                  dy={lineIndex === 0 ? (lines.length > 1 ? "-0.4em" : "0.35em") : "1.1em"}
                >
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
        <path
          d={`M ${left.x.toFixed(2)} ${left.y.toFixed(2)} A ${R_OUTER} ${R_OUTER} 0 0 0 ${right.x.toFixed(2)} ${right.y.toFixed(2)}`}
          fill="none"
          stroke="#111"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line x1={left.x} y1={CY} x2={right.x} y2={CY} stroke="#111" strokeWidth="2.5" />
        <polygon points={needlePoints(level)} fill="#1a1a1a" stroke="#f5f5f5" strokeWidth="1" />
        <circle cx={CX} cy={CY} r="11" fill="#1a1a1a" stroke="#f5f5f5" strokeWidth="2" />
      </svg>
    </div>
  );
}
