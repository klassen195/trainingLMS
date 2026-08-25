"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  GraduationCap,
  BookOpen,
  Shield,
  ClipboardList,
  ArrowLeftRight,
  Package,
  ClipboardPen,
  Users,
  Siren,
  Wrench,
  ListChecks,
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

  const breadcrumbs: Crumb[] = [{ label: "Dashboard", href: "/", icon: <Home className="h-4 w-4" /> }];

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
      breadcrumbs.push({ label: "Equipment" });
    } else if (paths[1] === "apparatus") {
      breadcrumbs.push({ label: "Apparatus" });
    } else if (paths[1] === "maintenance") {
      breadcrumbs.push({ label: "Maintenance requests" });
    } else if (paths[1] === "new") {
      breadcrumbs.push({ label: "New" });
    } else if (paths[1]) {
      breadcrumbs.push({
        label: "Detail",
        href:
          paths[2] === "edit" || paths[2] === "maintenance" || paths[2] === "vehicle-check"
            ? `/assets/${paths[1]}`
            : undefined,
      });
      if (paths[2] === "edit") {
        breadcrumbs.push({ label: "Edit" });
      } else if (paths[2] === "maintenance") {
        breadcrumbs.push({ label: "Request maintenance" });
      }
    }
  } else if (paths[0] === "personnel") {
    breadcrumbs.push({
      label: "Personnel",
      href: paths.length === 1 ? undefined : "/personnel",
      icon: <Users className="h-4 w-4" />,
    });
    if (paths[1] === "new") {
      breadcrumbs.push({ label: "Invite" });
    } else if (paths[1] === "supervisor") {
      breadcrumbs.push({ label: "Supervisor dashboard" });
    } else if (paths[1]) {
      breadcrumbs.push({
        label: "Detail",
        href: paths[2] === "edit" ? `/personnel/${paths[1]}` : undefined,
      });
      if (paths[2] === "edit") {
        breadcrumbs.push({ label: "Edit" });
      }
    }
  } else if (paths[0] === "fleet") {
    breadcrumbs.push({
      label: "Fleet",
      href: paths.length === 1 ? undefined : "/fleet",
      icon: <Wrench className="h-4 w-4" />,
    });
  } else if (paths[0] === "incidents") {
    breadcrumbs.push({
      label: "Incidents",
      href: paths.length === 1 ? undefined : "/incidents",
      icon: <Siren className="h-4 w-4" />,
    });
    if (paths[1] === "new") {
      breadcrumbs.push({ label: "New" });
    } else if (paths[1]) {
      breadcrumbs.push({ label: "Board" });
    }
  } else if (paths[0] === "approval-tracker") {
    breadcrumbs.push({
      label: "Policy Tracker",
      href: paths.length === 1 ? undefined : "/approval-tracker",
      icon: <ListChecks className="h-4 w-4" />,
    });
    if (paths[1] === "new") {
      breadcrumbs.push({ label: "New" });
    } else if (paths[1]) {
      breadcrumbs.push({ label: "Document" });
    }
  } else {
    paths.forEach((path, index) => {
      const currentPath = `/${paths.slice(0, index + 1).join("/")}`;
      const isLast = index === paths.length - 1;

      if (path === "dashboard") {
        breadcrumbs.push({
          label: "Programs",
          href: isLast ? undefined : "/programs",
          icon: <GraduationCap className="h-4 w-4" />,
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
      } else if (path === "clients") {
        breadcrumbs.push({
          label: "Clients",
          href: isLast ? undefined : currentPath,
        });
      } else if (path === "platform-operators") {
        breadcrumbs.push({
          label: "Platform operators",
          href: isLast ? undefined : currentPath,
        });
      } else if (path === "ems-qi") {
        breadcrumbs.push({
          label: "EMS QI",
          href: isLast ? undefined : "/ems-qi",
          icon: <ClipboardList className="h-4 w-4" />,
        });
      } else if (path === "document-training") {
        breadcrumbs.push({
          label: "Document Training",
          href: isLast ? undefined : "/document-training",
          icon: <ClipboardPen className="h-4 w-4" />,
        });
      } else if (path === "approval-tracker") {
        breadcrumbs.push({
          label: "Policy Tracker",
          href: isLast ? undefined : "/admin/approval-tracker",
          icon: <ListChecks className="h-4 w-4" />,
        });
      } else if (path === "new" && paths[index - 1] === "document-training") {
        breadcrumbs.push({
          label: "Log training",
          href: isLast ? undefined : currentPath,
        });
      } else if (
        paths[index - 1] === "document-training" &&
        /^[0-9a-f-]{36}$/i.test(path)
      ) {
        breadcrumbs.push({
          label: "Session",
          href: isLast ? undefined : currentPath,
        });
      } else if (path === "edit" && paths[index - 2] === "document-training") {
        breadcrumbs.push({
          label: "Edit",
          href: isLast ? undefined : currentPath,
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
                        <Link
                          href={crumb.href!}
                          className="flex items-center gap-2 hover:underline"
                          onClick={() => {
                            if (crumb.href !== "/personnel") return;
                            if (typeof window === "undefined") return;
                            if (window.location.hash) {
                              window.history.replaceState(
                                null,
                                "",
                                `${window.location.pathname}${window.location.search}`
                              );
                            }
                          }}
                        >
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
