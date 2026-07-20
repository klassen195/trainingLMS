import Link from "next/link";
import { cn } from "@/lib/cn";

function stationHref(stationNumber: number) {
  return `/shift-exchange/station/${stationNumber}`;
}

export function ShiftExchangeStationNav({ activeStation }: { activeStation: number }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => {
        const active = n === activeStation;
        return (
          <Link
            key={n}
            href={stationHref(n)}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors",
              active
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            Station {n}
          </Link>
        );
      })}
    </div>
  );
}
