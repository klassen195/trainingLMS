"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  Shield,
  LogOut,
  Menu,
  BookOpen,
  UserRound,
  ArrowLeftRight,
  Package,
  ClipboardPen,
  Users,
  Siren,
  Lightbulb,
} from "lucide-react";
import { signOut } from "@/app/actions";
import { cn } from "@/lib/cn";
import type { Profile } from "@/lib/training-lms-types";
import { permissionLevelName } from "@/lib/permission-levels";
import { Button } from "@/components/ui/Button";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuInlineContent,
} from "@/components/ui/DropdownMenu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";

function authNavItemsFor(showIncidents: boolean) {
  return [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/shift-exchange", label: "Shift Exchange", icon: ArrowLeftRight },
    { href: "/programs", label: "Programs", icon: GraduationCap },
    { href: "/assets", label: "Assets", icon: Package },
    ...(showIncidents ? [{ href: "/incidents", label: "Incidents", icon: Siren }] : []),
    {
      href: "/personnel",
      label: "Personnel",
      icon: Users,
    },
    { href: "/document-training", label: "Training", icon: ClipboardPen },
  ];
}

export function MainNav({
  profile,
  showInstructor = false,
  showAdmin = false,
  showIncidents = false,
}: {
  profile: Profile | null;
  showInstructor?: boolean;
  showAdmin?: boolean;
  showIncidents?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const displayName = profile?.display_name ?? profile?.email ?? "Member";
  const initials = displayName.charAt(0).toUpperCase();
  const accessLabel = profile
    ? [permissionLevelName(profile.permission_levels), profile.is_admin ? "Admin" : null]
        .filter(Boolean)
        .join(" · ")
    : null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      router.push("/");
    });
  }

  const loggedInNavItems = [
    ...(profile ? authNavItemsFor(showIncidents) : []),
    ...(showInstructor ? [{ href: "/instructor", label: "Instructor", icon: BookOpen }] : []),
    ...(showAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  const allNavItems = profile ? loggedInNavItems : [];

  return (
    <nav className="relative z-[100] w-full overflow-visible border-b bg-background">
      <div className="container relative mx-auto flex h-20 items-center px-4">
        <Link href="/" className="relative z-10 flex shrink-0 items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            FD
          </div>
          <span className="hidden lg:inline text-xl font-bold">Anchor Point</span>
        </Link>

        <div className="absolute inset-x-0 hidden justify-center pointer-events-none md:flex">
          <div className="pointer-events-auto flex items-start gap-1">
            {allNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-[4.5rem] flex-col items-center gap-1 rounded-md px-1.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive(item.href) && "bg-accent text-accent-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background",
                    isActive(item.href) && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="flex min-h-[2rem] items-start justify-center text-center text-[10px] font-medium leading-tight">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="relative z-10 ml-auto hidden items-center gap-2 md:flex">
          {profile ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-md">
                  <Avatar className="h-10 w-10 rounded-md">
                    <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuInlineContent className="w-56" align="end" sideOffset={8}>
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    {profile.email ? (
                      <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
                    ) : null}
                    <p className="text-xs leading-none text-muted-foreground">{accessLabel}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <UserRound className="mr-2 h-4 w-4" />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/ideas">
                    <Lightbulb className="mr-2 h-4 w-4" />
                    Ideas
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/personnel">
                    <Users className="mr-2 h-4 w-4" />
                    Personnel
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={pending} onSelect={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {pending ? "Signing out..." : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuInlineContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>

        <div className="relative z-10 ml-auto flex items-center gap-2 md:hidden">
          {profile ? (
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
            </Avatar>
          ) : null}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-md">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>TrainingLMS menu</SheetDescription>
              </SheetHeader>
              <div className="mt-8 grid grid-cols-3 items-start gap-3 px-1">
                {allNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-md px-2 py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive(item.href) && "bg-accent text-accent-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-background",
                        isActive(item.href) && "border-primary bg-primary text-primary-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="flex min-h-[2.5rem] items-start justify-center text-center text-xs font-medium leading-tight">
                      {item.label}
                    </span>
                  </Link>
                ))}
                {profile ? (
                  <>
                    <Link
                      href="/account"
                      onClick={() => setMobileOpen(false)}
                      className="flex flex-col items-center gap-2 rounded-md px-2 py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-background">
                        <UserRound className="h-5 w-5" />
                      </span>
                      <span className="flex min-h-[2.5rem] items-start justify-center text-center text-xs font-medium leading-tight">
                        Account
                      </span>
                    </Link>
                    <Link
                      href="/ideas"
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-md px-2 py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                        isActive("/ideas") && "bg-accent text-accent-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-background",
                          isActive("/ideas") && "border-primary bg-primary text-primary-foreground"
                        )}
                      >
                        <Lightbulb className="h-5 w-5" />
                      </span>
                      <span className="flex min-h-[2.5rem] items-start justify-center text-center text-xs font-medium leading-tight">
                        Ideas
                      </span>
                    </Link>
                  </>
                ) : null}
              </div>
              {profile ? (
                <div className="mt-6 space-y-3 border-t pt-4">
                  <div className="flex items-center gap-3 px-1">
                    <Avatar className="h-10 w-10 rounded-md">
                      <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{displayName}</span>
                      <span className="text-xs text-muted-foreground">{accessLabel}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" disabled={pending} onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button asChild className="mt-6 w-full">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Sign in
                  </Link>
                </Button>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
