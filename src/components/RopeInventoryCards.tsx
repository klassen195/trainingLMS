import type { ReactNode } from "react";
import Link from "next/link";
import { Box, Truck } from "lucide-react";
import { ComplementBadge } from "@/components/RopeBreadcrumbs";
import { RopeAuditButton, RopeAuditSummaryLine } from "@/components/RopeAudit";
import { RopeBagCards } from "@/components/RopeBagCards";
import { RopeEditFrame } from "@/components/RopeEditFrame";
import { RopeLooseSection } from "@/components/RopeBagPanel";
import { AddBagForm, AddCompartmentForm, NameEditor, StopRopeTrackingButton } from "@/components/RopeForms";
import type { RopeCompartmentBoard } from "@/lib/rope";
import { type RopeCompartmentSummary, type RopeStationTruck } from "@/lib/rope-types";

function cardGridClass() {
  return "grid grid-cols-[repeat(auto-fill,minmax(9.75rem,11.25rem))] justify-start gap-3";
}

const closedCardClass =
  "flex aspect-square flex-col justify-between rounded-xl border bg-card p-3 shadow-sm hover:bg-accent";
const openCardClass = "col-span-full rounded-xl border bg-card p-4 shadow-sm";

function CloseLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="shrink-0 text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      Close
    </Link>
  );
}

export function RopeCompartmentPanel({
  board,
  canManage,
  closeHref,
  deleteRedirect,
  titleTag: TitleTag = "h1",
  closeCardHref,
}: {
  board: RopeCompartmentBoard;
  canManage: boolean;
  closeHref: string;
  deleteRedirect: string;
  titleTag?: "h1" | "h2" | "h3";
  closeCardHref?: string;
}) {
  const bagTitle = TitleTag === "h1" ? "h2" : TitleTag === "h2" ? "h3" : "h4";
  return (
    <RopeEditFrame
      canManage={canManage}
      editLabel="Edit compartment"
      actions={
        canManage ? (
          <RopeAuditButton label="Audit compartment" compartmentId={board.compartment.id} groups={board.checklist} />
        ) : undefined
      }
      header={
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Box className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Compartment</p>
              <TitleTag className="text-xl font-bold">{board.compartment.name}</TitleTag>
              <p className="mt-1 text-sm text-muted-foreground">
                Bags in this compartment, and any gear stored loose.
              </p>
              <RopeAuditSummaryLine summary={board.audit} />
            </div>
          </div>
          {closeCardHref ? <CloseLink href={closeCardHref} /> : null}
        </div>
      }
      editor={
        <>
          <NameEditor
            id={board.compartment.id}
            name={board.compartment.name}
            kind="compartment"
            redirectTo={deleteRedirect}
          />
          <AddBagForm compartmentId={board.compartment.id} />
        </>
      }
    >
      <RopeBagCards
        key={board.compartment.id}
        bags={board.bags}
        bagViews={board.bagViews}
        gearTypes={board.gearTypes}
        targets={board.targets}
        attachOptions={board.attachOptions}
        canManage={canManage}
        initialBagId={board.initialBagId}
        redirectTo={closeHref}
        titleTag={bagTitle}
      />
      <RopeLooseSection
        canManage={canManage}
        compartmentId={board.compartment.id}
        bagId={board.looseBagId}
        lines={board.looseLines}
        gearTypes={board.gearTypes}
        attachOptions={board.attachOptions}
      />
    </RopeEditFrame>
  );
}

export function RopeCompartmentCards({
  compartments,
  hrefForCompartment,
  openId,
  openBody,
}: {
  compartments: RopeCompartmentSummary[];
  hrefForCompartment: (compartmentId: string) => string;
  openId?: string;
  openBody?: ReactNode;
}) {
  if (compartments.length === 0) {
    return <p className="text-sm text-muted-foreground">No compartments yet.</p>;
  }

  return (
    <div className={cardGridClass()}>
      {compartments.map((compartment) => {
        if (compartment.id !== openId) {
          return (
            <Link
              key={compartment.id}
              href={hrefForCompartment(compartment.id)}
              scroll={false}
              className={closedCardClass}
            >
              <span className="inline-flex min-w-0 items-start gap-2 font-semibold">
                <Box className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 line-clamp-3">{compartment.name}</span>
              </span>
              <span className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {compartment.bagCount} {compartment.bagCount === 1 ? "bag" : "bags"}
                </span>
                <ComplementBadge short={compartment.short} requiredLineCount={compartment.requiredLineCount} />
              </span>
            </Link>
          );
        }

        return (
          <div key={compartment.id} className={openCardClass}>
            {openBody}
          </div>
        );
      })}
    </div>
  );
}

export function RopeVehiclePanel({
  apparatusId,
  label,
  canManage,
  compartments,
  hrefForCompartment,
  openCompartmentId,
  openCompartment,
  closeHref,
  titleTag: TitleTag = "h2",
}: {
  apparatusId: string;
  label: string;
  canManage: boolean;
  compartments: RopeCompartmentSummary[];
  hrefForCompartment: (compartmentId: string) => string;
  openCompartmentId?: string;
  openCompartment?: ReactNode;
  closeHref?: string;
  titleTag?: "h1" | "h2";
}) {
  return (
    <RopeEditFrame
      canManage={canManage}
      editLabel="Edit vehicle"
      header={
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Truck className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vehicle</p>
              <TitleTag className="text-xl font-bold">{label}</TitleTag>
              <p className="mt-1 text-sm text-muted-foreground">
                Compartments on this vehicle. Open one to see its bags and loose equipment.
              </p>
            </div>
          </div>
          {closeHref ? <CloseLink href={closeHref} /> : null}
        </div>
      }
      editor={
        <>
          <AddCompartmentForm apparatusId={apparatusId} />
          {compartments.length === 0 ? <StopRopeTrackingButton apparatusId={apparatusId} /> : null}
        </>
      }
    >
      <RopeCompartmentCards
        compartments={compartments}
        hrefForCompartment={hrefForCompartment}
        openId={openCompartmentId}
        openBody={openCompartment}
      />
    </RopeEditFrame>
  );
}

export function RopeVehicleCards({
  trucks,
  hrefForVehicle,
  openId,
  openBody,
}: {
  trucks: RopeStationTruck[];
  hrefForVehicle: (vehicleId: string) => string;
  openId?: string;
  openBody?: ReactNode;
}) {
  if (trucks.length === 0) {
    return <p className="text-sm text-muted-foreground">No apparatus is tracking tech rescue inventory yet.</p>;
  }

  return (
    <div className={cardGridClass()}>
      {trucks.map((truck) => {
        if (truck.id !== openId) {
          return (
            <Link key={truck.id} href={hrefForVehicle(truck.id)} scroll={false} className={closedCardClass}>
              <span className="inline-flex min-w-0 items-start gap-2 font-semibold">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 line-clamp-3">{truck.label}</span>
              </span>
              <span className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {truck.compartmentCount} {truck.compartmentCount === 1 ? "compartment" : "compartments"}
                </span>
                <ComplementBadge short={truck.short} requiredLineCount={truck.requiredLineCount} />
              </span>
            </Link>
          );
        }

        return (
          <div key={truck.id} className={openCardClass}>
            {openBody}
          </div>
        );
      })}
    </div>
  );
}
