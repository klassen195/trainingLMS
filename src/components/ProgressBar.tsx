import { cn } from "@/lib/cn";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800", className)}>
      <div
        className="h-full rounded-full bg-[#C11B2B] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
