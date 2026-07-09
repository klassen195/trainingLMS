"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { Program } from "@/lib/training-lms-types";
import { categoryLabel } from "@/lib/labels";
import { programEnrollmentLabel } from "@/lib/program-enrollment-status";
import { HighlightStarButton } from "@/components/HighlightStarButton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ProgressBar";

export function ProgramCard({
  program,
  progressPercent,
  moduleCount = 0,
  enrolledCount = 0,
  highlighted = false,
  showStar = false,
}: {
  program: Program;
  progressPercent?: number | null;
  moduleCount?: number;
  enrolledCount?: number;
  highlighted?: boolean;
  showStar?: boolean;
}) {
  const showProgress = progressPercent !== null && progressPercent !== undefined;
  const enrollmentStatus = programEnrollmentLabel(enrolledCount, moduleCount);
  const starVisible = showStar || highlighted;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} whileHover={{ y: -4 }}>
      <Card className="relative h-full transition-shadow hover:shadow-lg">
        {starVisible ? (
          <div className="absolute right-2 top-2 z-10">
            <HighlightStarButton
              target="program"
              programId={program.id}
              highlighted={highlighted}
              label={program.title}
            />
          </div>
        ) : null}
        <Link href={`/programs/${program.id}`} className="block h-full cursor-pointer">
          <CardHeader>
            <div className="mb-2 flex flex-wrap items-center gap-2 pr-10">
              <Badge variant="outline">{categoryLabel(program.category)}</Badge>
              <Badge variant="secondary" className="capitalize">
                {program.status}
              </Badge>
            </div>
            <CardTitle className="line-clamp-2">{program.title}</CardTitle>
            {program.description ? <CardDescription className="line-clamp-2">{program.description}</CardDescription> : null}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>{moduleCount} module{moduleCount === 1 ? "" : "s"}</span>
            </div>
            {enrollmentStatus === "not_enrolled" ? (
              <p className="mt-4 text-sm text-muted-foreground">Not enrolled</p>
            ) : enrollmentStatus === "partially_enrolled" ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Partially enrolled ({enrolledCount} of {moduleCount} modules)
                </p>
                {showProgress && progressPercent > 0 ? (
                  <ProgressBar value={progressPercent} showLabel />
                ) : showProgress ? (
                  <p className="text-sm text-muted-foreground">0% complete</p>
                ) : null}
              </div>
            ) : showProgress && progressPercent > 0 ? (
              <div className="mt-4 space-y-2">
                <ProgressBar value={progressPercent} showLabel />
              </div>
            ) : showProgress ? (
              <p className="mt-4 text-sm text-muted-foreground">0% complete</p>
            ) : null}
          </CardContent>
          <CardFooter>
            <span className="text-sm font-medium text-primary">View program →</span>
          </CardFooter>
        </Link>
      </Card>
    </motion.div>
  );
}
