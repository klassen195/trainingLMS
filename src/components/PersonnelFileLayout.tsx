"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PersonnelFileSectionId =
  | "demographics"
  | "work"
  | "ems"
  | "certifications"
  | "qualifications"
  | "taskbooks"
  | "recognitions"
  | "security"
  | "training"
  | "documents"
  | "notes";

export type PersonnelFileSection = {
  id: PersonnelFileSectionId;
  label: string;
  content: ReactNode;
};

const DEFAULT_SECTION: PersonnelFileSectionId = "demographics";

function parseHash(hash: string, allowed: Set<string>): PersonnelFileSectionId | null {
  const id = hash.replace(/^#/, "");
  if (allowed.has(id)) return id as PersonnelFileSectionId;
  return null;
}

export function PersonnelFileLayout({
  sections,
}: {
  sections: PersonnelFileSection[];
}) {
  const allowed = useMemo(() => new Set(sections.map((s) => s.id)), [sections]);
  const fallback = sections.some((s) => s.id === DEFAULT_SECTION)
    ? DEFAULT_SECTION
    : sections[0]?.id;

  const [activeId, setActiveId] = useState<PersonnelFileSectionId | undefined>(fallback);

  useEffect(() => {
    function syncFromHash() {
      const fromHash = parseHash(window.location.hash, allowed);
      setActiveId(fromHash ?? fallback);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [allowed, fallback]);

  function selectSection(id: PersonnelFileSectionId) {
    setActiveId(id);
    const next = `#${id}`;
    if (window.location.hash !== next) {
      // replaceState avoids the browser scrolling to a matching id/anchor.
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${next}`);
    }
  }

  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  if (!active) return null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
      <nav
        aria-label="Personnel file sections"
        className="lg:sticky lg:top-4 lg:w-52 lg:shrink-0"
      >
        <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {sections.map((section) => {
            const isActive = section.id === active.id;
            return (
              <li key={section.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => selectSection(section.id)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {section.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight">{active.label}</h2>
        </div>
        {active.content}
      </div>
    </div>
  );
}

export function PersonnelFieldGrid({
  rows,
  variant = "default",
}: {
  rows: { label: string; value: ReactNode; fullWidth?: boolean }[];
  variant?: "default" | "compact";
}) {
  const compact = variant === "compact";

  return (
    <dl
      className={
        compact ? "grid gap-x-6 gap-y-2.5 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2"
      }
    >
      {rows.map((row) => {
        const isMultiline = typeof row.value === "string" && row.value.includes("\n");
        return (
          <div
            key={row.label}
            className={cn(
              row.fullWidth || isMultiline ? "sm:col-span-2" : undefined,
              compact && "flex items-baseline gap-3"
            )}
          >
            <dt
              className={cn(
                "text-xs font-medium uppercase tracking-wide text-muted-foreground",
                compact && "w-36 shrink-0 leading-tight"
              )}
            >
              {row.label}
            </dt>
            <dd
              className={cn(
                "whitespace-pre-wrap text-sm",
                compact ? "min-w-0 flex-1" : "mt-1"
              )}
            >
              {row.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function PersonnelSectionEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
