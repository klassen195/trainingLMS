"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, Truck } from "lucide-react";
import { cn } from "@/lib/cn";

const tabs = [
  { href: "/assets/ppe", label: "PPE", icon: HardHat },
  { href: "/assets/apparatus", label: "Apparatus", icon: Truck },
] as const;

export function AssetsSectionNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
