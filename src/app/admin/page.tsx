import {
  BadgeCheck,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Cross,
  type LucideIcon,
  MapPin,
  Shield,
  ShieldCheck,
  Tags,
  Users,
  Wrench,
  Layers,
  ListTree,
  ListChecks,
} from "lucide-react";
import Link from "next/link";
import { getAuthContext, requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type AdminLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type AdminGroup = {
  title: string;
  items: AdminLink[];
};

const ADMIN_GROUPS: AdminGroup[] = [
  {
    title: "People",
    items: [
      {
        href: "/personnel",
        label: "Personnel",
        description: "Directory, invites, and personnel files",
        icon: Users,
      },
      {
        href: "/admin/permissions",
        label: "Permissions",
        description: "Named levels and capability matrix",
        icon: Shield,
      },
      {
        href: "/admin/ems-levels",
        label: "EMS levels",
        description: "License levels held on personnel files",
        icon: Cross,
      },
      {
        href: "/admin/ems-clearance-levels",
        label: "EMS clearance",
        description: "Cleared-to-operate levels",
        icon: ShieldCheck,
      },
    ],
  },
  {
    title: "Training",
    items: [
      {
        href: "/admin/training-categories",
        label: "Categories",
        description: "Document training categories",
        icon: Tags,
      },
      {
        href: "/admin/qualifications",
        label: "Qualifications",
        description: "Qualifications granted by training",
        icon: BadgeCheck,
      },
      {
        href: "/admin/approval-tracker",
        label: "Policy Tracker",
        description: "Special Projects, committees, and later-stage owners",
        icon: ListChecks,
      },
    ],
  },
  {
    title: "Assets",
    items: [
      {
        href: "/admin/locations",
        label: "Locations",
        description: "Stations and other sites",
        icon: MapPin,
      },
      {
        href: "/admin/equipment-categories",
        label: "Equipment categories",
        description: "Inventory category list",
        icon: Layers,
      },
      {
        href: "/admin/equipment-subcategories",
        label: "Equipment subcategories",
        description: "Subcategories under each category",
        icon: ListTree,
      },
      {
        href: "/admin/vehicle-checks",
        label: "Vehicle checks",
        description: "Apparatus checklist templates",
        icon: ClipboardCheck,
      },
      {
        href: "/admin/maintenance",
        label: "Maintenance",
        description: "Review apparatus requests",
        icon: Wrench,
      },
    ],
  },
];

export default async function AdminPage() {
  await requireAdmin();
  const ctx = await getAuthContext();
  const isPlatformAdmin = ctx.kind === "authenticated" && ctx.isPlatformAdmin;

  const groups = isPlatformAdmin
    ? [
        {
          title: "Platform",
          items: [
            {
              href: "/admin/clients",
              label: "Clients",
              description: "Client ID codes and tenant silos",
              icon: Building2,
            },
          ],
        },
        ...ADMIN_GROUPS,
      ]
    : ADMIN_GROUPS;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Admin</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Department settings, catalogs, and access.
        </p>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight text-muted-foreground">
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-6 py-3 transition-colors",
                          "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{item.label}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
