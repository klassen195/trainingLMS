"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveRopeAudit } from "@/app/assets/rope/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldLabel } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { formatDateTime } from "@/lib/dates";
import {
  ropeAuditReasonLabel,
  type RopeAuditGroup,
  type RopeAuditReason,
  type RopeAuditSummary,
  type RopeLineAuditFlag,
} from "@/lib/rope-types";

const REASONS: RopeAuditReason[] = ["missing", "damaged", "other"];

export function RopeAuditSummaryLine({ summary }: { summary: RopeAuditSummary | null }) {
  if (!summary) return null;
  const result =
    summary.findingCount === 0
      ? "Meets spec"
      : `${summary.findingCount} finding${summary.findingCount === 1 ? "" : "s"}`;
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      Last audit {formatDateTime(summary.createdAt)} · {result}
    </p>
  );
}

export function RopeAuditFlag({ flag }: { flag: RopeLineAuditFlag }) {
  const className =
    flag.reason === "missing"
      ? "bg-destructive text-destructive-foreground"
      : flag.reason === "damaged"
        ? "bg-amber-500 text-white"
        : "bg-muted text-foreground";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {ropeAuditReasonLabel(flag.reason)}
    </span>
  );
}

export function RopeAuditButton({
  label,
  bagId,
  compartmentId,
  groups,
}: {
  label: string;
  bagId?: string;
  compartmentId?: string;
  groups: RopeAuditGroup[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"check" | "note">("check");
  const [answers, setAnswers] = useState<Record<string, "pass" | "fail">>({});
  const [details, setDetails] = useState<
    Record<string, { reason: RopeAuditReason; quantity: string; notes: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const refreshAfterClose = useRef(false);

  useEffect(() => {
    if (open || !refreshAfterClose.current) return;
    const timer = window.setTimeout(() => {
      document.body.style.pointerEvents = "";
      document.body.removeAttribute("data-scroll-locked");
      refreshAfterClose.current = false;
      router.refresh();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, router]);

  const lines = useMemo(() => groups.flatMap((group) => group.lines), [groups]);
  const failed = lines.filter((line) => answers[line.lineId] === "fail");
  const ready = lines.length > 0 && lines.every((line) => answers[line.lineId]);

  function reset() {
    setStep("check");
    setAnswers({});
    setDetails({});
    setError(null);
    setPending(false);
  }

  function detailFor(lineId: string) {
    return details[lineId] ?? { reason: "missing" as const, quantity: "1", notes: "" };
  }

  async function finish(findings: Parameters<typeof saveRopeAudit>[0]["findings"]) {
    setError(null);
    setPending(true);
    try {
      await saveRopeAudit({ bagId: bagId ?? null, compartmentId: compartmentId ?? null, findings });
      if (open) {
        refreshAfterClose.current = true;
        setOpen(false);
      } else {
        setPending(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-md"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex-1 overflow-y-auto p-6">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle>{label}</SheetTitle>
              <SheetDescription>
                {lines.length === 0
                  ? "Nothing on this loadout is required."
                  : step === "check"
                    ? `${Object.keys(answers).length} of ${lines.length} checked.`
                    : "Note what does not meet spec. Those quantities count as short until the next audit."}
              </SheetDescription>
            </SheetHeader>

            {lines.length === 0 ? null : step === "check" ? (
              <div className="mt-6 space-y-5">
                <Button type="button" disabled={pending} onClick={() => void finish([])}>
                  Pass audit
                </Button>
                {groups.map((group) => (
                  <section key={group.bagId} className="space-y-3">
                    {groups.length > 1 ? <h3 className="text-sm font-semibold">{group.bagName}</h3> : null}
                    <ul className="space-y-3">
                      {group.lines.map((line) => (
                        <li key={line.lineId} className="space-y-2">
                          <p className="text-sm font-medium">
                            {line.gearTypeName}
                            {line.gearSpec ? (
                              <span className="ml-2 font-normal text-muted-foreground">{line.gearSpec}</span>
                            ) : null}
                          </p>
                          <p className="text-sm text-muted-foreground">Required {line.expectedQuantity}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={answers[line.lineId] === "pass" ? "default" : "outline"}
                              onClick={() => setAnswers((current) => ({ ...current, [line.lineId]: "pass" }))}
                            >
                              Meets spec
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={answers[line.lineId] === "fail" ? "default" : "outline"}
                              onClick={() => setAnswers((current) => ({ ...current, [line.lineId]: "fail" }))}
                            >
                              Does not
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {error ? <FieldError>{error}</FieldError> : null}
                <Button
                  type="button"
                  disabled={!ready || pending}
                  onClick={() => {
                    if (failed.length === 0) {
                      void finish([]);
                      return;
                    }
                    setStep("note");
                  }}
                >
                  {failed.length === 0 ? "Save audit" : "Review findings"}
                </Button>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {failed.map((line) => {
                  const detail = detailFor(line.lineId);
                  return (
                    <section key={line.lineId} className="space-y-2 border-t pt-4">
                      <h3 className="text-sm font-semibold">
                        {line.gearTypeName}
                        {line.gearSpec ? (
                          <span className="ml-2 font-normal text-muted-foreground">{line.gearSpec}</span>
                        ) : null}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {REASONS.map((reason) => (
                          <Button
                            key={reason}
                            type="button"
                            size="sm"
                            variant={detail.reason === reason ? "default" : "outline"}
                            onClick={() =>
                              setDetails((current) => ({
                                ...current,
                                [line.lineId]: { ...detail, reason },
                              }))
                            }
                          >
                            {ropeAuditReasonLabel(reason)}
                          </Button>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <FieldLabel htmlFor={`audit-qty-${line.lineId}`}>How many</FieldLabel>
                        <Input
                          id={`audit-qty-${line.lineId}`}
                          type="number"
                          min={1}
                          max={10000}
                          step={1}
                          inputMode="numeric"
                          value={detail.quantity}
                          onChange={(event) =>
                            setDetails((current) => ({
                              ...current,
                              [line.lineId]: { ...detail, quantity: event.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <FieldLabel htmlFor={`audit-note-${line.lineId}`}>
                          Note{detail.reason === "other" ? "" : " (optional)"}
                        </FieldLabel>
                        <Input
                          id={`audit-note-${line.lineId}`}
                          value={detail.notes}
                          maxLength={500}
                          onChange={(event) =>
                            setDetails((current) => ({
                              ...current,
                              [line.lineId]: { ...detail, notes: event.target.value },
                            }))
                          }
                        />
                      </div>
                    </section>
                  );
                })}
                {error ? <FieldError>{error}</FieldError> : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("check")}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void finish(
                        failed.map((line) => {
                          const detail = detailFor(line.lineId);
                          return {
                            bagId: line.bagId,
                            gearTypeId: line.gearTypeId,
                            reason: detail.reason,
                            quantity: Number(detail.quantity),
                            notes: detail.notes,
                          };
                        })
                      )
                    }
                  >
                    Save audit
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
