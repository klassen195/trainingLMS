"use client";

import { useEffect, useRef, useState } from "react";
import { Backpack } from "lucide-react";
import { ComplementBadge } from "@/components/RopeBreadcrumbs";
import { RopeAuditSummaryLine } from "@/components/RopeAudit";
import { RopeBagSection } from "@/components/RopeBagPanel";
import { ropeComplementLabel, type RopeAttachOption, type RopeAuditSummary, type RopeBagLineView, type RopeBagSummary, type RopeGearType, type RopeLoadoutTarget } from "@/lib/rope-types";

const closedCardClass =
  "flex aspect-square w-full flex-col justify-between rounded-xl border bg-card p-3 text-left shadow-sm hover:bg-accent";

export function RopeBagCards({
  bags,
  bagViews,
  gearTypes,
  targets,
  attachOptions,
  canManage,
  initialBagId,
  redirectTo,
  titleTag: TitleTag = "h2",
}: {
  bags: RopeBagSummary[];
  bagViews: Record<string, { lines: RopeBagLineView[]; audit: RopeAuditSummary | null }>;
  gearTypes: RopeGearType[];
  targets: RopeLoadoutTarget[];
  attachOptions: RopeAttachOption[];
  canManage: boolean;
  initialBagId: string | null;
  redirectTo: string;
  titleTag?: "h2" | "h3" | "h4";
}) {
  const [openId, setOpenId] = useState<string | null>(initialBagId);
  const openRef = useRef<HTMLDivElement>(null);
  const open = openId ? (bagViews[openId] ?? null) : null;
  const openSummary = bags.find((bag) => bag.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    openRef.current?.scrollIntoView({ block: "nearest" });
  }, [openId]);

  if (bags.length === 0) {
    return <p className="text-sm text-muted-foreground">No bags yet.</p>;
  }

  const closed = bags.filter((bag) => bag.id !== openId);
  const short = open ? open.lines.reduce((sum, line) => sum + line.short, 0) : 0;
  const requiredLineCount = open ? open.lines.filter((line) => line.expectedQuantity > 0).length : 0;

  return (
    <div className="space-y-3">
      {open && openSummary ? (
        <div ref={openRef} className="rounded-xl border bg-card p-4 shadow-sm">
          <RopeBagSection
            canManage={canManage}
            bagId={openSummary.id}
            bagName={openSummary.name}
            redirectTo={redirectTo}
            lines={open.lines}
            gearTypes={gearTypes}
            loadoutTargets={targets.filter((target) => target.id !== openSummary.id)}
            attachOptions={attachOptions}
            header={
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Backpack className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <TitleTag className="text-xl font-bold">{openSummary.name}</TitleTag>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ropeComplementLabel(short, requiredLineCount)}. Required gear compared with what is actually in
                      the bag.
                    </p>
                    <RopeAuditSummaryLine summary={open.audit} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="shrink-0 text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Close
                </button>
              </div>
            }
          />
        </div>
      ) : null}
      {closed.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.75rem,11.25rem))] justify-start gap-3">
          {closed.map((bag) => (
            <button key={bag.id} type="button" onClick={() => setOpenId(bag.id)} className={closedCardClass}>
              <span className="inline-flex min-w-0 items-start gap-2 font-semibold">
                <Backpack className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 line-clamp-3">{bag.name}</span>
              </span>
              <span className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {bag.lineCount} {bag.lineCount === 1 ? "item" : "items"}
                </span>
                {bag.openFindings > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    {bag.openFindings} {bag.openFindings === 1 ? "finding" : "findings"}
                  </span>
                ) : null}
                <ComplementBadge short={bag.short} requiredLineCount={bag.requiredLineCount} />
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
