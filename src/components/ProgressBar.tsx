import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  className,
  showLabel = false,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <div className={cn("w-full", className)}>
      {showLabel ? (
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{Math.round(value)}%</span>
        </div>
      ) : null}
      <Progress value={value} className="h-2" />
    </div>
  );
}
