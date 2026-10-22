import type { ReactNode } from "react";
import Link from "next/link";
import { Box, Cable, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function TechRescueLink() {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <Link
        href="/assets/rope"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        <Cable className="h-4 w-4" />
        Tech Rescue
      </Link>
      <Button variant="outline" size="sm" className="shrink-0" asChild>
        <Link href="/assets/rope/cache">Reserve cache</Link>
      </Button>
    </div>
  );
}

export function RopeContextCard({
  tone = "muted",
  icon,
  kicker,
  title,
  titleAs = "span",
  href,
  aside,
  children,
}: {
  tone?: "muted" | "card" | "plain";
  icon: ReactNode;
  kicker: string;
  title: string;
  titleAs?: "span" | "h1";
  href?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const TitleTag = titleAs;
  const heading = (
    <span className="inline-flex min-w-0 items-center gap-2">
      {icon}
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</span>
        <TitleTag className={`block truncate font-semibold ${titleAs === "h1" ? "text-xl" : ""}`}>{title}</TitleTag>
      </span>
    </span>
  );

  return (
    <section
      className={
        tone === "muted"
          ? "rounded-xl border bg-muted/40 p-3 sm:p-4"
          : tone === "card"
            ? "ml-3 rounded-xl border bg-card p-3 sm:ml-6 sm:p-4"
            : "ml-3 rounded-xl border bg-background p-3 sm:ml-6 sm:p-4"
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {href ? (
          <Link href={href} className="min-w-0 hover:underline">
            {heading}
          </Link>
        ) : (
          heading
        )}
        {aside}
      </div>
      {children}
    </section>
  );
}

export function RopeBagNest({
  apparatusLabel,
  apparatusHref,
  compartmentName,
  compartmentHref,
  children,
}: {
  apparatusLabel: string;
  apparatusHref: string;
  compartmentName: string;
  compartmentHref: string;
  children: ReactNode;
}) {
  return (
    <RopeContextCard
      icon={<Truck className="h-4 w-4 shrink-0 text-primary" />}
      kicker="Vehicle"
      title={apparatusLabel}
      href={apparatusHref}
    >
      <RopeContextCard
        tone="card"
        icon={<Box className="h-4 w-4 shrink-0 text-primary" />}
        kicker="Compartment"
        title={compartmentName}
        href={compartmentHref}
      >
        <div className="ml-3 rounded-xl border bg-background p-3 sm:ml-6 sm:p-4">{children}</div>
      </RopeContextCard>
    </RopeContextCard>
  );
}
