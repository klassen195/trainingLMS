"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import type { UserHighlightItem } from "@/lib/user-highlights";
import { HighlightStarButton } from "@/components/HighlightStarButton";
import { ProgramCard } from "@/components/ProgramCard";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function MyProgramsSection({ items }: { items: UserHighlightItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-10 text-center">
        <p className="text-muted-foreground">
          Star programs or modules to pin them here for quick access.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) =>
        item.kind === "program" ? (
          <ProgramCard
            key={`program-${item.program.id}`}
            program={item.program}
            progressPercent={item.progressPercent ?? undefined}
            enrolledCount={item.enrolledCount}
            moduleCount={item.moduleCount}
            highlighted
            showStar
          />
        ) : (
          <ModuleHighlightCard key={`module-${item.module.id}`} item={item} />
        )
      )}
    </div>
  );
}

function ModuleHighlightCard({ item }: { item: Extract<UserHighlightItem, { kind: "module" }> }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="relative h-full transition-shadow hover:shadow-lg">
        <div className="absolute right-2 top-2 z-10">
          <HighlightStarButton
            target="module"
            moduleId={item.module.id}
            programId={item.programId}
            highlighted
            label={item.module.title}
          />
        </div>
        <Link href={`/programs/${item.programId}/modules/${item.module.id}`} className="block h-full">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 pr-10">
              <Badge variant="outline">Module</Badge>
            </div>
            <CardTitle className="line-clamp-2">{item.module.title}</CardTitle>
            <CardDescription className="line-clamp-1">In {item.programTitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>Module highlight</span>
            </div>
          </CardContent>
          <CardFooter>
            <span className="text-sm font-medium text-primary">Open module →</span>
          </CardFooter>
        </Link>
      </Card>
    </motion.div>
  );
}
