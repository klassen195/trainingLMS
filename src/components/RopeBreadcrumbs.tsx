import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ropeComplementLabel } from "@/lib/rope-types";

export function RopeBreadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Tech rescue location" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function ComplementBadge({
  short,
  requiredLineCount,
}: {
  short: number;
  requiredLineCount: number;
}) {
  const label = ropeComplementLabel(short, requiredLineCount);
  const variant = requiredLineCount === 0 ? "outline" : short > 0 ? "destructive" : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}
