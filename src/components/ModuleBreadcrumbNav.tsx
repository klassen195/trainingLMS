"use client";

import { usePathname } from "next/navigation";
import { ProgramBreadcrumb } from "@/components/ProgramBreadcrumb";
import type { ModuleResource } from "@/lib/training-lms-types";

export function ModuleBreadcrumbNav({
  programId,
  programTitle,
  moduleId,
  moduleTitle,
  resources,
}: {
  programId: string;
  programTitle: string;
  moduleId: string;
  moduleTitle: string;
  resources: ModuleResource[];
}) {
  const pathname = usePathname();
  const resourceId = pathname.match(/\/resources\/([^/]+)/)?.[1];
  const resource = resources.find((item) => item.id === resourceId);

  return (
    <ProgramBreadcrumb
      programId={programId}
      programTitle={programTitle}
      moduleId={moduleId}
      moduleTitle={moduleTitle}
      resourceTitle={resource?.title}
    />
  );
}
