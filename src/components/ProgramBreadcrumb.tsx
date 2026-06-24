import Link from "next/link";
import { Home, GraduationCap } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/Breadcrumb";

export function ProgramBreadcrumb({
  programId,
  programTitle,
  moduleId,
  moduleTitle,
  resourceTitle,
}: {
  programId: string;
  programTitle: string;
  moduleId?: string;
  moduleTitle?: string;
  resourceTitle?: string;
}) {
  return (
    <div className="border-b bg-muted/40">
      <div className="container mx-auto px-4 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="flex items-center gap-2 hover:underline">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/programs" className="flex items-center gap-2 hover:underline">
                  <GraduationCap className="h-4 w-4" />
                  Programs
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/programs/${programId}`} className="hover:underline">
                  {programTitle}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {moduleTitle ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {resourceTitle && moduleId ? (
                    <BreadcrumbLink asChild>
                      <Link href={`/programs/${programId}/modules/${moduleId}`} className="hover:underline">
                        {moduleTitle}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{moduleTitle}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </>
            ) : null}
            {resourceTitle ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{resourceTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
