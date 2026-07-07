"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, GraduationCap, BookOpen, Shield } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/Breadcrumb";

type Crumb = { label: string; href?: string; icon?: React.ReactNode };

export function BreadcrumbNav() {
  const pathname = usePathname();
  const paths = pathname.split("/").filter(Boolean);

  // Program detail, module, and resource pages render ProgramBreadcrumb in their layout/page.
  if (paths[0] === "programs" && paths.length > 1) {
    return null;
  }

  const breadcrumbs: Crumb[] = [{ label: "Home", href: "/dashboard", icon: <Home className="h-4 w-4" /> }];

  paths.forEach((path, index) => {
    const currentPath = `/${paths.slice(0, index + 1).join("/")}`;
    const isLast = index === paths.length - 1;

    if (path === "dashboard") {
      breadcrumbs.push({
        label: "Dashboard",
        href: isLast ? undefined : "/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      });
    } else if (path === "programs") {
      breadcrumbs.push({
        label: "Programs",
        href: isLast ? undefined : "/programs",
        icon: <GraduationCap className="h-4 w-4" />,
      });
    } else if (path === "instructor") {
      breadcrumbs.push({
        label: "Instructor",
        href: isLast ? undefined : "/instructor",
        icon: <BookOpen className="h-4 w-4" />,
      });
    } else if (path === "admin") {
      breadcrumbs.push({
        label: "Admin",
        href: isLast ? undefined : "/admin",
        icon: <Shield className="h-4 w-4" />,
      });
    } else if (!isLast || paths[index - 1] !== "programs") {
      breadcrumbs.push({
        label: path.charAt(0).toUpperCase() + path.slice(1),
        href: isLast ? undefined : currentPath,
      });
    }
  });

  if (breadcrumbs.length <= 1) return null;

  return (
    <div className="border-b bg-muted/40">
      <div className="container mx-auto px-4 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={crumb.label} className="flex items-center">
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="flex items-center gap-2">
                        {crumb.icon}
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href!} className="flex items-center gap-2 hover:underline">
                          {crumb.icon}
                          {crumb.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? <BreadcrumbSeparator /> : null}
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
