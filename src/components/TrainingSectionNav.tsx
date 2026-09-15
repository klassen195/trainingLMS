import Link from "next/link";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/document-training", label: "Log sessions", match: "exact" as const },
  { href: "/document-training/upcoming", label: "Upcoming", match: "prefix" as const },
  { href: "/document-training/requests", label: "Requests", match: "prefix" as const },
];

export function TrainingSectionNav({ pathname }: { pathname: string }) {
  return (
    <nav className="mb-5 flex flex-wrap gap-1 border-b">
      {TABS.map((tab) => {
        const active =
          tab.match === "exact"
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
