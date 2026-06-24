"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { resourceTypeLabel } from "@/lib/module-resources";
import type { ModuleResource } from "@/lib/training-lms-types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function ModuleResourceList({
  programId,
  moduleId,
  resources,
  enrolled,
  completedResourceIds,
}: {
  programId: string;
  moduleId: string;
  resources: ModuleResource[];
  enrolled: boolean;
  completedResourceIds: string[];
}) {
  if (resources.length === 0) {
    return null;
  }

  const completedSet = new Set(completedResourceIds);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Module resources</CardTitle>
        {!enrolled ? (
          <p className="text-sm text-muted-foreground">Not enrolled — progress is not tracked</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {resources.map((resource, index) => {
          const isCompleted = enrolled && completedSet.has(resource.id);
          const row = (
            <motion.div
              whileHover={{ x: 4 }}
              className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                isCompleted ? "border-green-500 bg-green-950/40" : "border-border hover:bg-muted"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {index + 1}
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                {!enrolled ? (
                  <Circle className="h-5 w-5 text-muted-foreground/50" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{resource.title}</span>
                  {isCompleted ? (
                    <Badge className="bg-green-600 text-xs">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Complete
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{resourceTypeLabel(resource.resource_type)}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </motion.div>
          );

          return (
            <Link
              key={resource.id}
              href={`/programs/${programId}/modules/${moduleId}/resources/${resource.id}`}
              className="block"
            >
              {row}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
