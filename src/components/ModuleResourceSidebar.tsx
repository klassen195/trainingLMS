"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CheckCircle2, Circle } from "lucide-react";
import { resourceTypeLabel, partitionModuleResources } from "@/lib/module-resources";
import type { ModuleResource } from "@/lib/training-lms-types";
import { cn } from "@/lib/cn";

export function ModuleResourceSidebar({
  programId,
  moduleId,
  moduleTitle,
  resources,
  enrolled,
  completedResourceIds,
}: {
  programId: string;
  moduleId: string;
  moduleTitle: string;
  resources: ModuleResource[];
  enrolled: boolean;
  completedResourceIds: string[];
}) {
  const pathname = usePathname();
  const overviewHref = `/programs/${programId}/modules/${moduleId}`;
  const isOverview = pathname === overviewHref;
  const completedSet = new Set(completedResourceIds);
  const { linkedResources } = partitionModuleResources(resources);

  return (
    <nav className="rounded-lg border bg-card p-4">
      <div className="mb-4 border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Module</p>
        <p className="mt-1 font-semibold leading-snug">{moduleTitle}</p>
        {!enrolled ? (
          <p className="mt-2 text-xs text-muted-foreground">Not enrolled</p>
        ) : null}
      </div>

      <ul className="space-y-1">
        <li>
          <Link
            href={overviewHref}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
              isOverview && "bg-accent font-medium text-accent-foreground"
            )}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            Overview
          </Link>
        </li>
      </ul>

      {linkedResources.length > 0 ? (
        <div className="mt-4 border-t pt-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Resources</p>
          <ul className="space-y-1">
            {linkedResources.map((resource) => {
              const href = `/programs/${programId}/modules/${moduleId}/resources/${resource.id}`;
              const isActive = pathname === href;
              const isCompleted = enrolled && completedSet.has(resource.id);
              return (
                <li key={resource.id}>
                  <Link
                    href={href}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                      isActive && "bg-accent font-medium text-accent-foreground"
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {!enrolled ? (
                          <Circle className="h-4 w-4 text-muted-foreground/50" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{resource.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {resourceTypeLabel(resource.resource_type)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
