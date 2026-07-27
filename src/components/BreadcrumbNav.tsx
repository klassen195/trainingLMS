"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Shield,
  ClipboardList,
  ArrowLeftRight,
  Package,
} from "lucide-react";
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

  // Landing page and program detail trees use their own navigation.
  if (paths.length === 0) return null;
  if (paths[0] === "programs" && paths.length > 1) {
    return null;
  }

  const breadcrumbs: Crumb[] = [{ label: "Home", href: "/", icon: <Home className="h-4 w-4" /> }];

  if (paths[0] === "shift-exchange") {
    breadcrumbs.push({
      label: "Shift Exchange",
      href: paths.length === 1 ? undefined : "/shift-exchange",
      icon: <ArrowLeftRight className="h-4 w-4" />,
    });
    if (paths[1] === "station" && paths[2]) {
      breadcrumbs.push({ label: `Station ${paths[2]}` });
    }
  } else if (paths[0] === "assets") {
    breadcrumbs.push({
      label: "Assets",
      href: paths.length === 1 ? undefined : "/assets",
      icon: <Package className="h-4 w-4" />,
    });
    if (paths[1] === "ppe") {
      breadcrumbs.push({ label: "PPE" });
    } else if (paths[1] === "apparatus") {
      breadcrumbs.push({ label: "Apparatus" });
    } else if (paths[1] === "new") {
      breadcrumbs.push({ label: "New" });
    } else if (paths[1]) {
      breadcrumbs.push({
        label: "Detail",
        href: paths[2] === "edit" ? `/assets/${paths[1]}` : undefined,
      });
      if (paths[2] === "edit") {
        breadcrumbs.push({ label: "Edit" });
      }
    }
  } else {
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
      } else if (path === "ems-qi") {
        breadcrumbs.push({
          label: "EMS QI",
          href: isLast ? undefined : "/ems-qi",
          icon: <ClipboardList className="h-4 w-4" />,
        });
      } else if (!isLast || paths[index - 1] !== "programs") {
        breadcrumbs.push({
          label: path.charAt(0).toUpperCase() + path.slice(1),
          href: isLast ? undefined : currentPath,
        });
      }
    });
  }

  if (breadcrumbs.length <= 1) return null;

  return (
    <div className="border-b bg-muted/40">
      <div className="container mx-auto px-4 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={`${crumb.label}-${index}`} className="flex items-center">
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
