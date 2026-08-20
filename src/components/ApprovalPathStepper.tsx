import { cn } from "@/lib/cn";
import {
  APPROVAL_STAGES,
  approvalStageIndex,
  approvalStageLabel,
  approvalStageShortLabel,
  type ApprovalStage,
} from "@/lib/approval-tracker-types";

function stageTone(stage: ApprovalStage, current: ApprovalStage) {
  const stageIdx = approvalStageIndex(stage);
  const currentIdx = approvalStageIndex(current);
  if (stageIdx < currentIdx) return "done";
  if (stageIdx === currentIdx) return "current";
  return "upcoming";
}

export function ApprovalPathDots({
  currentStage,
  className,
}: {
  currentStage: ApprovalStage;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-1", className)} aria-label="Approval path">
      {APPROVAL_STAGES.map((stage, index) => {
        const tone = stageTone(stage, currentStage);
        return (
          <li key={stage} className="flex min-w-0 items-center gap-1">
            {index > 0 ? (
              <span
                className={cn(
                  "h-px w-3 shrink-0 sm:w-4",
                  tone === "upcoming" ? "bg-border" : "bg-primary"
                )}
              />
            ) : null}
            <span
              title={approvalStageLabel(stage)}
              className={cn(
                "block size-2.5 shrink-0 rounded-full",
                tone === "done" && "bg-primary",
                tone === "current" && "bg-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
                tone === "upcoming" && "bg-muted-foreground/30"
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}

export function ApprovalPathStepper({
  currentStage,
}: {
  currentStage: ApprovalStage;
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-6">
      {APPROVAL_STAGES.map((stage, index) => {
        const tone = stageTone(stage, currentStage);
        return (
          <li key={stage} className="relative">
            <div
              className={cn(
                "flex h-full flex-col rounded-lg border px-3 py-3",
                tone === "current" && "border-primary bg-primary/5",
                tone === "done" && "border-primary/40 bg-muted/40",
                tone === "upcoming" && "border-border bg-background"
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Step {index + 1}
              </span>
              <span className="mt-1 text-sm font-semibold leading-tight">
                <span className="sm:hidden">{approvalStageShortLabel(stage)}</span>
                <span className="hidden sm:inline">{approvalStageLabel(stage)}</span>
              </span>
              {tone === "current" ? (
                <span className="mt-2 text-xs font-medium text-primary">Current</span>
              ) : tone === "done" ? (
                <span className="mt-2 text-xs text-muted-foreground">Passed</span>
              ) : (
                <span className="mt-2 text-xs text-muted-foreground">Upcoming</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
