"use client";

import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import {
  expiringItemKindLabel,
  expiringWhenLabel,
  type ExpiringPersonnelItem,
} from "@/lib/personnel-types";

function urgencyClass(daysUntil: number) {
  if (daysUntil < 0) return "text-destructive";
  if (daysUntil <= 30) return "text-amber-800";
  return "text-muted-foreground";
}

export function PersonnelExpiringNotifications({
  items,
  withinMonths = 6,
}: {
  items: ExpiringPersonnelItem[];
  withinMonths?: number;
}) {
  const count = items.length;
  const hasUrgent = items.some((item) => item.daysUntil <= 30);

  function goToSection(sectionId: ExpiringPersonnelItem["sectionId"]) {
    const next = `#${sectionId}`;
    if (window.location.hash !== next) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${next}`
      );
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "relative h-9 w-9 shrink-0",
            hasUrgent && "border-amber-300 bg-amber-50 hover:bg-amber-100"
          )}
          aria-label={
            count === 0
              ? `No items expiring in the next ${withinMonths} months`
              : `${count} item${count === 1 ? "" : "s"} expiring in the next ${withinMonths} months`
          }
        >
          <Bell className="h-4 w-4" />
          {count > 0 ? (
            <span
              className={cn(
                "absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none",
                hasUrgent
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-0">
        <DropdownMenuLabel className="px-3 py-2.5 font-semibold">
          Expiring in the next {withinMonths} months
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        {count === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            Nothing expired or due in this window.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <DropdownMenuItem
                  className="cursor-pointer items-start gap-2 px-3 py-2.5"
                  onSelect={() => goToSection(item.sectionId)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {expiringItemKindLabel(item.kind)} · {formatDate(item.expiresOn)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "max-w-[7.5rem] shrink-0 pt-0.5 text-right text-xs font-medium",
                      urgencyClass(item.daysUntil)
                    )}
                  >
                    {expiringWhenLabel(item.daysUntil)}
                  </span>
                </DropdownMenuItem>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
