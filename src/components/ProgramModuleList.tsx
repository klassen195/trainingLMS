"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import type { ProgramModuleEntry } from "@/lib/training-lms-types";
import { HighlightStarButton } from "@/components/HighlightStarButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function ProgramModuleList({
  programId,
  modules,
  enrolledModuleIds,
  completedModuleIds,
  highlightedModuleIds,
  canOpen,
}: {
  programId: string;
  modules: ProgramModuleEntry[];
  enrolledModuleIds: Set<string>;
  completedModuleIds: Set<string>;
  highlightedModuleIds?: Set<string>;
  canOpen: boolean;
}) {
  if (modules.length === 0) {
    return <p className="text-sm text-muted-foreground">No modules in this program yet.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Program modules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {modules.map((moduleItem, index) => {
          const isEnrolled = enrolledModuleIds.has(moduleItem.id);
          const isCompleted = isEnrolled && completedModuleIds.has(moduleItem.id);
          const isHighlighted = highlightedModuleIds?.has(moduleItem.id) ?? false;
          const row = (
            <motion.div
              whileHover={canOpen ? { x: 4 } : undefined}
              className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                isCompleted ? "border-green-500 bg-green-950/40" : "border-border hover:bg-muted"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {index + 1}
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                {!isEnrolled ? (
                  <Circle className="h-5 w-5 text-muted-foreground/50" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{moduleItem.title}</span>
                  {!isEnrolled ? (
                    <Badge variant="secondary" className="text-xs">
                      Not enrolled
                    </Badge>
                  ) : isCompleted ? (
                    <Badge className="bg-green-600 text-xs">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Complete
                    </Badge>
                  ) : null}
                </div>
                {moduleItem.content ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{moduleItem.content}</p>
                ) : null}
              </div>
              <HighlightStarButton
                target="module"
                moduleId={moduleItem.id}
                programId={programId}
                highlighted={isHighlighted}
                label={moduleItem.title}
              />
              {canOpen ? <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" /> : null}
            </motion.div>
          );

          return canOpen ? (
            <Link key={moduleItem.id} href={`/programs/${programId}/modules/${moduleItem.id}`} className="block">
              {row}
            </Link>
          ) : (
            <div key={moduleItem.id}>{row}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}
