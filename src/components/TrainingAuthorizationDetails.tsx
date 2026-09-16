import { cn } from "@/lib/cn";
import type { TrainingAuthorizationBadge } from "@/lib/upcoming-training-types";

export function TrainingAuthorizationDetails({
  badge,
  className,
  compact = false,
}: {
  badge: TrainingAuthorizationBadge;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("font-medium", compact ? "text-sm" : "text-base")}>{badge.label}</div>
      <dl className={cn("grid gap-1.5", compact ? "text-xs" : "text-sm")}>
        {badge.fields.map((field) => (
          <div key={field.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className={field.included ? "text-foreground" : "text-muted-foreground"}>
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
