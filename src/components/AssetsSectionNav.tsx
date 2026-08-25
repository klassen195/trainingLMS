"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, Truck, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";

export function AssetsSectionNav({
  showApparatus = true,
  showMaintenance = false,
}: {
  showApparatus?: boolean;
  showMaintenance?: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: "/assets/ppe", label: "Equipment", icon: HardHat, show: true },
    { href: "/assets/apparatus", label: "Apparatus", icon: Truck, show: showApparatus },
    { href: "/assets/maintenance", label: "Maintenance", icon: Wrench, show: showMaintenance },
  ].filter((tab) => tab.show);

  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
